import { Injectable, Logger } from '@nestjs/common';
import { LongBackgammonEngine, LongBoardState } from '../games/game-engine/long-backgammon-engine';
import * as crypto from 'crypto';

export interface MCTSAnalysis {
  equity: number; // Вероятность выигрыша текущего игрока (0-1)
  winProbabilities: {
    win: number;
    winG: number;
    winBG: number;
    loseG: number;
    loseBG: number;
  };
  bestMove?: {
    moves: Array<{ from: number; to: number; die: number }>;
    equity: number;
  };
  alternatives?: Array<{
    moves: Array<{ from: number; to: number; die: number }>;
    equity: number;
    diff: number;
  }>;
  moveQuality?: 'excellent' | 'good' | 'neutral' | 'doubtful' | 'bad' | 'very bad';
}

interface MCTSNode {
  state: LongBoardState;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  winsGammon: number; // Количество выигрышей с гаммоном
  winsBackgammon: number; // Количество выигрышей с бэкгэммоном
  untriedMoves: Array<Array<{ from: number; to: number; die: number }>>;
  move: Array<{ from: number; to: number; die: number }> | null;
  player: number; // Игрок, который сделал ход к этому узлу
  heuristicValue?: number; // Эвристическая оценка позиции
}

interface SimulationResult {
  winner: number; // 0 или 1
  isGammon: boolean; // Гаммон (противник не вынес ни одной шашки)
  isBackgammon: boolean; // Бэкгэммон (противник не вынес ни одной шашки и есть шашки на баре или в доме противника)
}

interface CacheEntry {
  equity: number;
  winProbabilities: {
    win: number;
    winG: number;
    winBG: number;
    loseG: number;
    loseBG: number;
  };
  bestMove?: { moves: Array<{ from: number; to: number; die: number }>; equity: number };
  alternatives?: Array<{ moves: Array<{ from: number; to: number; die: number }>; equity: number; diff: number }>;
  timestamp: number;
}

@Injectable()
export class MCTSLongBackgammonService {
  private readonly logger = new Logger(MCTSLongBackgammonService.name);
  private readonly MAX_ITERATIONS: number;
  private readonly EXPLORATION_CONSTANT = Math.sqrt(2); // Константа для UCB1
  private readonly MAX_SIMULATION_DEPTH = 200; // Максимальная глубина симуляции
  private readonly CACHE_TTL = 3600000; // Время жизни кэша: 1 час
  private readonly MAX_CACHE_SIZE = 1000; // Максимальный размер кэша
  private readonly DEFAULT_TIME_LIMIT_MS: number;
  
  // Кэш для результатов анализа позиций
  private positionCache: Map<string, CacheEntry> = new Map();
  
  // Параллельные симуляции - уменьшено для слабых серверов
  private readonly PARALLEL_SIMULATIONS = 1; // Количество параллельных симуляций (1 для снижения нагрузки)

  constructor(private longBackgammonEngine: LongBackgammonEngine) {
    // Читаем настройки из переменных окружения
    this.MAX_ITERATIONS = parseInt(process.env.MCTS_MAX_ITERATIONS || '1000', 10);
    this.DEFAULT_TIME_LIMIT_MS = parseInt(process.env.MCTS_TIME_LIMIT_MS || '5000', 10);
    
    this.logger.log(`MCTS инициализирован: MAX_ITERATIONS=${this.MAX_ITERATIONS}, DEFAULT_TIME_LIMIT_MS=${this.DEFAULT_TIME_LIMIT_MS}`);
    
    // Очистка кэша каждые 10 минут
    setInterval(() => this.cleanCache(), 600000);
  }

  /**
   * Анализ позиции с помощью MCTS
   */
  async analyzePosition(
    state: LongBoardState,
    dice?: number[],
    timeLimitMs?: number,
  ): Promise<MCTSAnalysis | null> {
    const actualTimeLimit = timeLimitMs ?? this.DEFAULT_TIME_LIMIT_MS;
    try {
      // Проверяем кэш
      const cacheKey = this.getCacheKey(state, dice);
      const cached = this.positionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.logger.debug('Использован кэшированный результат анализа');
        return {
          equity: cached.equity,
          winProbabilities: cached.winProbabilities,
          bestMove: cached.bestMove,
          alternatives: cached.alternatives,
          moveQuality: this.determineMoveQuality(cached.equity, cached.alternatives),
        };
      }

      // Если есть кубики, используем их, иначе генерируем случайные
      const currentDice = dice && dice.length > 0 
        ? dice 
        : this.longBackgammonEngine.rollDice();

      // Создаем корневой узел с эвристической оценкой
      const root = this.createNode(state, null, null, state.currentPlayer);
      root.heuristicValue = this.evaluatePosition(state);

      // Запускаем MCTS с параллельными симуляциями
      const startTime = Date.now();
      let iterations = 0;

      while (iterations < this.MAX_ITERATIONS && (Date.now() - startTime) < actualTimeLimit) {
        // 1. Selection: выбираем узел для расширения
        const node = this.select(root);

        // 2. Expansion: расширяем узел
        const expandedNode = this.expand(node);

        // 3. Simulation: симулируем игру до конца (последовательно для снижения нагрузки)
        const results: SimulationResult[] = [];
        for (let i = 0; i < this.PARALLEL_SIMULATIONS; i++) {
          const result = await this.simulateAsync(expandedNode.state);
          results.push(result);
          
          // Небольшая задержка между симуляциями для снижения нагрузки CPU
          if (i < this.PARALLEL_SIMULATIONS - 1) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }

        // 4. Backpropagation: обновляем статистику для всех результатов
        for (const result of results) {
          this.backpropagate(expandedNode, result, expandedNode.state.currentPlayer);
        }

        iterations += this.PARALLEL_SIMULATIONS;
      }

      this.logger.debug(`MCTS выполнено ${iterations} итераций за ${Date.now() - startTime}ms`);

      // Получаем лучший ход и альтернативы
      const bestMove = this.getBestMove(root, currentDice);
      const alternatives = this.getAlternatives(root, currentDice, bestMove);

      // Вычисляем equity и вероятности на основе статистики корневого узла
      const equity = root.visits > 0 ? root.wins / root.visits : 0.5;
      const winG = root.visits > 0 ? root.winsGammon / root.visits : 0;
      const winBG = root.visits > 0 ? root.winsBackgammon / root.visits : 0;
      
      // Вычисляем проигрыши с гаммоном (противник выиграл с гаммоном)
      const loseG = root.visits > 0 ? (root.visits - root.wins - root.winsGammon - root.winsBackgammon) / root.visits : 0;
      const loseBG = 0; // Бэкгэммон в длинных нардах редок

      // Определяем качество хода
      const moveQuality = this.determineMoveQuality(equity, alternatives);

      const result: MCTSAnalysis = {
        equity,
        winProbabilities: {
          win: equity,
          winG,
          winBG,
          loseG,
          loseBG,
        },
        bestMove,
        alternatives,
        moveQuality,
      };

      // Сохраняем в кэш
      this.saveToCache(cacheKey, result);

      return result;
    } catch (error: any) {
      this.logger.error(`Ошибка MCTS анализа: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Анализ хода: сравнение сделанного хода с оптимальным
   */
  async analyzeMove(
    stateBefore: LongBoardState,
    stateAfter: LongBoardState,
    dice: number[],
    madeMove: Array<{ from: number; to: number; die: number }>,
    timeLimitMs?: number,
  ): Promise<{
    equityBefore: number;
    equityAfter: number;
    scoreChange: number;
    bestMove?: Array<{ from: number; to: number; die: number }>;
    alternatives?: Array<{
      moves: Array<{ from: number; to: number; die: number }>;
      equity: number;
      diff: number;
    }>;
    moveQuality?: 'excellent' | 'good' | 'neutral' | 'doubtful' | 'bad' | 'very bad';
  } | null> {
    try {
      const actualTimeLimit = timeLimitMs ?? this.DEFAULT_TIME_LIMIT_MS;
      
      // Анализируем позицию до хода
      const analysisBefore = await this.analyzePosition(stateBefore, dice, actualTimeLimit);
      if (!analysisBefore) return null;

      // Анализируем позицию после хода
      const analysisAfter = await this.analyzePosition(stateAfter, undefined, actualTimeLimit);
      if (!analysisAfter) return null;

      // Вычисляем изменение equity
      const scoreChange = analysisAfter.equity - analysisBefore.equity;

      // Определяем качество хода
      const moveQuality = this.determineMoveQualityFromScoreChange(scoreChange);

      return {
        equityBefore: analysisBefore.equity,
        equityAfter: analysisAfter.equity,
        scoreChange,
        bestMove: analysisBefore.bestMove?.moves,
        alternatives: analysisBefore.alternatives,
        moveQuality,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка анализа хода: ${error.message}`);
      return null;
    }
  }

  /**
   * Создание узла MCTS
   */
  private createNode(
    state: LongBoardState,
    parent: MCTSNode | null,
    move: Array<{ from: number; to: number; die: number }> | null,
    player: number,
  ): MCTSNode {
    // Генерируем все возможные ходы для этого состояния
    const untriedMoves = this.getAllPossibleMoves(state);

    // Вычисляем эвристическую оценку позиции
    const heuristicValue = this.evaluatePosition(state);

    return {
      state: this.cloneState(state),
      parent,
      children: [],
      visits: 0,
      wins: 0,
      winsGammon: 0,
      winsBackgammon: 0,
      untriedMoves,
      move,
      player,
      heuristicValue,
    };
  }

  /**
   * Selection: выбор узла для расширения (UCB1)
   */
  private select(node: MCTSNode): MCTSNode {
    while (node.children.length > 0 && node.untriedMoves.length === 0) {
      // Выбираем лучшего ребенка по UCB1
      node = this.selectBestChild(node);
    }
    return node;
  }

  /**
   * Выбор лучшего ребенка по UCB1
   */
  private selectBestChild(node: MCTSNode): MCTSNode {
    let bestChild: MCTSNode | null = null;
    let bestValue = -Infinity;

    for (const child of node.children) {
      const exploitation = child.visits > 0 ? child.wins / child.visits : 0;
      const exploration = this.EXPLORATION_CONSTANT * 
        Math.sqrt(Math.log(node.visits) / child.visits);
      
      // UCB1 для текущего игрока (максимизируем выигрыш)
      // Для противника минимизируем выигрыш
      const ucbValue = node.state.currentPlayer === child.player
        ? exploitation + exploration
        : (1 - exploitation) + exploration;

      if (ucbValue > bestValue) {
        bestValue = ucbValue;
        bestChild = child;
      }
    }

    return bestChild || node.children[0];
  }

  /**
   * Expansion: расширение узла добавлением нового ребенка
   * Используем эвристики для выбора более перспективных ходов
   */
  private expand(node: MCTSNode): MCTSNode {
    if (node.untriedMoves.length === 0) {
      return node;
    }

    // Используем эвристики для выбора хода вместо случайного
    let bestMoveIndex = 0;
    let bestMoveScore = -Infinity;

    for (let i = 0; i < node.untriedMoves.length; i++) {
      const move = node.untriedMoves[i];
      const newState = this.applyMove(node.state, move);
      const score = this.evaluateMove(node.state, newState, move);
      
      if (score > bestMoveScore) {
        bestMoveScore = score;
        bestMoveIndex = i;
      }
    }

    // Выбираем лучший ход по эвристике (с некоторой случайностью для исследования)
    const randomFactor = Math.random() * 0.3; // 30% случайности
    const selectedIndex = randomFactor < 0.1 
      ? Math.floor(Math.random() * node.untriedMoves.length) // Полностью случайный
      : bestMoveIndex; // Лучший по эвристике

    const move = node.untriedMoves.splice(selectedIndex, 1)[0];

    // Применяем ход к состоянию
    const newState = this.applyMove(node.state, move);

    // Создаем новый узел
    const child = this.createNode(
      newState,
      node,
      move,
      node.state.currentPlayer,
    );

    node.children.push(child);
    return child;
  }

  /**
   * Simulation: умная симуляция игры до конца с использованием эвристик
   */
  private simulate(state: LongBoardState): SimulationResult {
    let currentState = this.cloneState(state);
    let depth = 0;
    const originalPlayer = state.currentPlayer;
    const opponentBorneOffAtStart = currentState.borneOff[1 - originalPlayer];
    const opponentHasCheckersInHome = this.hasCheckersInHome(currentState, 1 - originalPlayer);

    while (!this.isTerminal(currentState) && depth < this.MAX_SIMULATION_DEPTH) {
      // Генерируем случайные кубики
      const dice = this.longBackgammonEngine.rollDice();
      
      // Получаем все возможные ходы
      const moves = this.getAllPossibleMoves(currentState, dice);
      
      if (moves.length === 0) {
        // Нет возможных ходов - пропускаем ход
        currentState.currentPlayer = 1 - currentState.currentPlayer;
        depth++;
        continue;
      }

      // Используем эвристики для выбора хода вместо полностью случайного
      const selectedMove = this.selectMoveForSimulation(currentState, moves);
      
      // Применяем ход
      currentState = this.applyMove(currentState, selectedMove);
      
      // Меняем игрока
      currentState.currentPlayer = 1 - currentState.currentPlayer;
      depth++;
    }

    // Определяем результат с учетом гаммонов
    return this.getResultWithGammons(currentState, originalPlayer, opponentBorneOffAtStart, opponentHasCheckersInHome);
  }

  /**
   * Асинхронная версия симуляции для параллельного выполнения
   */
  private async simulateAsync(state: LongBoardState): Promise<SimulationResult> {
    return new Promise((resolve) => {
      // Используем setImmediate для асинхронности
      setImmediate(() => {
        resolve(this.simulate(state));
      });
    });
  }

  /**
   * Выбор хода для симуляции с использованием эвристик
   */
  private selectMoveForSimulation(
    state: LongBoardState,
    moves: Array<Array<{ from: number; to: number; die: number }>>,
  ): Array<{ from: number; to: number; die: number }> {
    // 70% времени выбираем лучший ход по эвристике, 30% - случайный
    if (Math.random() < 0.7 && moves.length > 1) {
      let bestMove = moves[0];
      let bestScore = -Infinity;

      for (const move of moves) {
        const newState = this.applyMove(state, move);
        const score = this.evaluateMove(state, newState, move);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }

      return bestMove;
    }

    // Случайный выбор
    return moves[Math.floor(Math.random() * moves.length)];
  }

  /**
   * Backpropagation: обновление статистики узлов с учетом гаммонов
   */
  private backpropagate(node: MCTSNode, result: SimulationResult, originalPlayer: number): void {
    let currentNode: MCTSNode | null = node;

    while (currentNode !== null) {
      currentNode.visits++;
      
      // Определяем результат для текущего узла
      const isWin = result.winner === originalPlayer;
      const winValue = isWin ? 1 : 0;
      
      // Если результат соответствует игроку узла
      if (currentNode.player === originalPlayer) {
        currentNode.wins += winValue;
        
        // Учитываем гаммоны
        if (isWin && result.isBackgammon) {
          currentNode.winsBackgammon += 1;
        } else if (isWin && result.isGammon) {
          currentNode.winsGammon += 1;
        }
      } else {
        currentNode.wins += (1 - winValue);
        
        // Для противника учитываем проигрыши с гаммоном
        if (!isWin && result.isBackgammon) {
          currentNode.winsBackgammon += 1;
        } else if (!isWin && result.isGammon) {
          currentNode.winsGammon += 1;
        }
      }

      currentNode = currentNode.parent;
    }
  }

  /**
   * Получение всех возможных ходов для состояния
   */
  private getAllPossibleMoves(
    state: LongBoardState,
    dice?: number[],
  ): Array<Array<{ from: number; to: number; die: number }>> {
    const currentDice = dice || state.dice || this.longBackgammonEngine.rollDice();
    
    // Используем движок для получения всех валидных ходов
    try {
      // Проверяем, является ли это первым ходом игры
      const isFirstMove = this.isFirstMoveOfGame(state);
      
      // Используем метод getAllValidMoves из движка
      const validMoves = (this.longBackgammonEngine as any).getAllValidMoves(
        state,
        currentDice,
        isFirstMove,
      );
      
      return validMoves || [];
    } catch (error: any) {
      this.logger.warn(`Ошибка получения валидных ходов: ${error.message}`);
      return [];
    }
  }

  /**
   * Проверка, является ли это первым ходом игры
   */
  private isFirstMoveOfGame(state: LongBoardState): boolean {
    // Проверяем, все ли шашки на стартовых позициях
    const whiteOnHead = state.points[0] === 15;
    const blackOnHead = state.points[12] === -15;
    const noBorneOff = state.borneOff[0] === 0 && state.borneOff[1] === 0;
    
    return (whiteOnHead || blackOnHead) && noBorneOff;
  }

  /**
   * Применение хода к состоянию
   */
  private applyMove(
    state: LongBoardState,
    move: Array<{ from: number; to: number; die: number }>,
  ): LongBoardState {
    // Используем метод applyMoveSequence из движка для правильного применения хода
    try {
      let newState = this.cloneState(state);
      
      // Применяем каждый подход в последовательности
      for (const m of move) {
        newState = (this.longBackgammonEngine as any).applyMove(
          newState,
          m.from,
          m.to,
          m.die,
        );
      }
      
      // Меняем игрока после хода
      newState.currentPlayer = 1 - newState.currentPlayer;
      
      return newState;
    } catch (error: any) {
      this.logger.warn(`Ошибка применения хода: ${error.message}`);
      // Возвращаем исходное состояние при ошибке
      return this.cloneState(state);
    }
  }

  /**
   * Проверка терминального состояния (конец игры)
   */
  private isTerminal(state: LongBoardState): boolean {
    return state.borneOff[0] === 15 || state.borneOff[1] === 15;
  }

  /**
   * Получение результата игры с учетом гаммонов
   */
  private getResultWithGammons(
    state: LongBoardState,
    player: number,
    opponentBorneOffAtStart: number,
    opponentHasCheckersInHomeAtStart: boolean,
  ): SimulationResult {
    if (state.borneOff[player] === 15) {
      // Игрок выиграл
      const opponentBorneOff = state.borneOff[1 - player];
      
      // Бэкгэммон: противник не вынес ни одной шашки И есть шашки в доме противника или на баре
      const isBackgammon = opponentBorneOff === 0 && 
        (state.bar[1 - player] > 0 || this.hasCheckersInHome(state, 1 - player));
      
      // Гаммон: противник не вынес ни одной шашки (но не бэкгэммон)
      const isGammon = opponentBorneOff === 0 && !isBackgammon;
      
      return {
        winner: player,
        isGammon,
        isBackgammon,
      };
    } else if (state.borneOff[1 - player] === 15) {
      // Противник выиграл
      const playerBorneOff = state.borneOff[player];
      
      // Бэкгэммон: игрок не вынес ни одной шашки И есть шашки в доме или на баре
      const isBackgammon = playerBorneOff === 0 && 
        (state.bar[player] > 0 || this.hasCheckersInHome(state, player));
      
      // Гаммон: игрок не вынес ни одной шашки (но не бэкгэммон)
      const isGammon = playerBorneOff === 0 && !isBackgammon;
      
      return {
        winner: 1 - player,
        isGammon,
        isBackgammon,
      };
    }
    
    // Незавершенная игра (не должно происходить в терминальном состоянии)
    return {
      winner: player,
      isGammon: false,
      isBackgammon: false,
    };
  }

  /**
   * Клонирование состояния
   */
  private cloneState(state: LongBoardState): LongBoardState {
    return {
      points: [...state.points],
      bar: [...state.bar] as [number, number],
      borneOff: [...state.borneOff] as [number, number],
      currentPlayer: state.currentPlayer,
      dice: [...state.dice],
      movesFromHead: state.movesFromHead,
      movesFromPoint: { ...state.movesFromPoint },
    };
  }

  /**
   * Получение лучшего хода из корневого узла
   */
  private getBestMove(
    root: MCTSNode,
    dice: number[],
  ): { moves: Array<{ from: number; to: number; die: number }>; equity: number } | undefined {
    if (root.children.length === 0) return undefined;

    // Выбираем ребенка с наибольшим количеством посещений
    let bestChild = root.children[0];
    for (const child of root.children) {
      if (child.visits > bestChild.visits) {
        bestChild = child;
      }
    }

    const equity = bestChild.visits > 0 ? bestChild.wins / bestChild.visits : 0;

    return bestChild.move ? {
      moves: bestChild.move,
      equity,
    } : undefined;
  }

  /**
   * Получение альтернативных ходов
   */
  private getAlternatives(
    root: MCTSNode,
    dice: number[],
    bestMove?: { moves: Array<{ from: number; to: number; die: number }>; equity: number },
  ): Array<{ moves: Array<{ from: number; to: number; die: number }>; equity: number; diff: number }> {
    const alternatives: Array<{ moves: Array<{ from: number; to: number; die: number }>; equity: number; diff: number }> = [];

    const bestEquity = bestMove?.equity || 0;

    for (const child of root.children) {
      if (!child.move) continue;
      
      // Пропускаем лучший ход
      if (bestMove && JSON.stringify(child.move) === JSON.stringify(bestMove.moves)) {
        continue;
      }

      const equity = child.visits > 0 ? child.wins / child.visits : 0;
      const diff = equity - bestEquity;

      alternatives.push({
        moves: child.move,
        equity,
        diff,
      });
    }

    // Сортируем по equity (лучшие первые)
    alternatives.sort((a, b) => b.equity - a.equity);

    return alternatives.slice(0, 5); // Возвращаем топ-5 альтернатив
  }

  /**
   * Определение качества хода на основе equity
   */
  private determineMoveQuality(
    equity: number,
    alternatives?: Array<{ equity: number; diff: number }>,
  ): 'excellent' | 'good' | 'neutral' | 'doubtful' | 'bad' | 'very bad' {
    if (!alternatives || alternatives.length === 0) {
      return 'neutral';
    }

    const bestAlternative = alternatives[0];
    const diff = equity - bestAlternative.equity;

    if (diff >= 0.10) {
      return 'very bad';
    } else if (diff >= 0.05) {
      return 'bad';
    } else if (diff >= 0.02) {
      return 'doubtful';
    } else if (diff <= -0.02) {
      return 'excellent';
    } else if (diff <= -0.01) {
      return 'good';
    }

    return 'neutral';
  }

  /**
   * Определение качества хода на основе изменения equity
   */
  private determineMoveQualityFromScoreChange(scoreChange: number): 'excellent' | 'good' | 'neutral' | 'doubtful' | 'bad' | 'very bad' {
    if (scoreChange >= 0.10) {
      return 'very bad';
    } else if (scoreChange >= 0.05) {
      return 'bad';
    } else if (scoreChange >= 0.02) {
      return 'doubtful';
    } else if (scoreChange <= -0.02) {
      return 'excellent';
    } else if (scoreChange <= -0.01) {
      return 'good';
    }

    return 'neutral';
  }

  /**
   * Эвристическая оценка позиции
   * Возвращает значение от 0 до 1, где 1 - идеальная позиция для текущего игрока
   */
  private evaluatePosition(state: LongBoardState): number {
    const player = state.currentPlayer;
    const opponent = 1 - player;

    // Базовые факторы
    const borneOffScore = state.borneOff[player] / 15; // Прогресс выноса (0-1)
    const opponentBorneOffScore = state.borneOff[opponent] / 15;
    
    // Прогресс в доме
    const homeProgress = this.calculateHomeProgress(state, player);
    const opponentHomeProgress = this.calculateHomeProgress(state, opponent);
    
    // Блокирование противника
    const blockingScore = this.calculateBlockingScore(state, player);
    
    // Мобильность (количество возможных ходов)
    const mobilityScore = this.calculateMobility(state, player);
    
    // Комбинированная оценка
    const score = (
      borneOffScore * 0.4 +
      homeProgress * 0.2 +
      blockingScore * 0.2 +
      mobilityScore * 0.1 +
      (1 - opponentBorneOffScore) * 0.1
    );

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Оценка хода на основе изменения позиции
   */
  private evaluateMove(
    stateBefore: LongBoardState,
    stateAfter: LongBoardState,
    move: Array<{ from: number; to: number; die: number }>,
  ): number {
    const beforeScore = this.evaluatePosition(stateBefore);
    const afterScore = this.evaluatePosition(stateAfter);
    
    // Бонус за вынос шашек
    const borneOffBonus = (stateAfter.borneOff[stateBefore.currentPlayer] - 
                          stateBefore.borneOff[stateBefore.currentPlayer]) * 0.1;
    
    // Бонус за движение к дому
    const homeProgressBonus = this.calculateHomeProgress(stateAfter, stateBefore.currentPlayer) - 
                             this.calculateHomeProgress(stateBefore, stateBefore.currentPlayer);
    
    return (afterScore - beforeScore) + borneOffBonus + homeProgressBonus * 0.5;
  }

  /**
   * Вычисление прогресса в доме
   */
  private calculateHomeProgress(state: LongBoardState, player: number): number {
    const HOME_START = player === 0 ? 18 : 6;
    const HOME_END = player === 0 ? 24 : 12;
    
    let totalDistance = 0;
    let totalCheckers = 0;
    
    for (let i = HOME_START; i < HOME_END; i++) {
      const checkers = player === 0 
        ? Math.max(0, state.points[i])
        : Math.max(0, -state.points[i]);
      
      if (checkers > 0) {
        const distance = player === 0 ? (i - HOME_START) : (HOME_END - i);
        totalDistance += distance * checkers;
        totalCheckers += checkers;
      }
    }
    
    if (totalCheckers === 0) return 1; // Все шашки вынесены
    
    // Нормализуем: чем ближе к выносу, тем выше оценка
    const maxDistance = HOME_END - HOME_START;
    return 1 - (totalDistance / (totalCheckers * maxDistance));
  }

  /**
   * Вычисление блокады противника
   */
  private calculateBlockingScore(state: LongBoardState, player: number): number {
    const opponent = 1 - player;
    let blockingScore = 0;
    
    // Подсчитываем блоки (последовательности занятых точек)
    for (let i = 0; i < 24; i++) {
      const value = state.points[i];
      const isMyChecker = (player === 0 && value > 0) || (player === 1 && value < 0);
      
      if (isMyChecker) {
        // Проверяем, блокируем ли мы противника
        const opponentCanReach = this.canOpponentReach(state, opponent, i);
        if (!opponentCanReach) {
          blockingScore += 0.1;
        }
      }
    }
    
    return Math.min(1, blockingScore);
  }

  /**
   * Проверка, может ли противник достичь точки
   */
  private canOpponentReach(state: LongBoardState, opponent: number, targetPoint: number): boolean {
    // Упрощенная проверка: может ли противник дойти до точки за один ход
    for (let i = 0; i < 24; i++) {
      const value = state.points[i];
      const hasOpponentChecker = (opponent === 0 && value > 0) || (opponent === 1 && value < 0);
      
      if (hasOpponentChecker) {
        const distance = Math.abs(i - targetPoint);
        if (distance <= 6) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Вычисление мобильности (количество возможных ходов)
   */
  private calculateMobility(state: LongBoardState, player: number): number {
    const dice = [1, 2, 3, 4, 5, 6]; // Тестовые кубики
    let totalMoves = 0;
    
    for (const die of dice) {
      const moves = this.getAllPossibleMoves(state, [die]);
      totalMoves += moves.length;
    }
    
    // Нормализуем: максимум ~20-30 ходов за ход
    return Math.min(1, totalMoves / 30);
  }

  /**
   * Проверка, есть ли шашки в доме
   */
  private hasCheckersInHome(state: LongBoardState, player: number): boolean {
    const HOME_START = player === 0 ? 18 : 6;
    const HOME_END = player === 0 ? 24 : 12;
    
    for (let i = HOME_START; i < HOME_END; i++) {
      const checkers = player === 0 
        ? Math.max(0, state.points[i])
        : Math.max(0, -state.points[i]);
      
      if (checkers > 0) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Генерация ключа кэша для позиции
   */
  private getCacheKey(state: LongBoardState, dice?: number[]): string {
    const stateStr = JSON.stringify({
      points: state.points,
      bar: state.bar,
      borneOff: state.borneOff,
      currentPlayer: state.currentPlayer,
      dice: dice || state.dice,
    });
    
    return crypto.createHash('sha256').update(stateStr).digest('hex');
  }

  /**
   * Сохранение результата в кэш
   */
  private saveToCache(key: string, result: MCTSAnalysis): void {
    // Очищаем старые записи если кэш переполнен
    if (this.positionCache.size >= this.MAX_CACHE_SIZE) {
      this.cleanCache();
    }
    
    this.positionCache.set(key, {
      equity: result.equity,
      winProbabilities: result.winProbabilities,
      bestMove: result.bestMove,
      alternatives: result.alternatives,
      timestamp: Date.now(),
    });
  }

  /**
   * Очистка устаревших записей из кэша
   */
  private cleanCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.positionCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.positionCache.delete(key);
    }
    
    // Если все еще переполнен, удаляем самые старые
    if (this.positionCache.size >= this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.positionCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, entries.length - this.MAX_CACHE_SIZE + 100);
      for (const [key] of toDelete) {
        this.positionCache.delete(key);
      }
    }
    
    this.logger.debug(`Очистка кэша: удалено ${keysToDelete.length} записей, осталось ${this.positionCache.size}`);
  }
}

