import { Injectable, Inject, forwardRef, ForbiddenException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameMode } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';
import { GptBotService } from '../bot/gpt-bot.service';

interface WinProbabilities {
  win: number;
  winG: number;
  winBG: number;
  loseG: number;
  loseBG: number;
}

interface MoveAnalysis {
  moveNumber: number;
  move: GameMove;
  isError: boolean;
  errorType?: 'blunder' | 'mistake' | 'inaccuracy';
  errorDescription?: string;
  isBestMove?: boolean; // Флаг что это лучший ход (максимальный equity)
  bestMove?: Array<{ from: number; to: number; die: number }>;
  scoreChange: number;
  equity?: number;
  winProbabilities?: WinProbabilities;
  moveQuality?: number; // Качество хода от 0 до 1
  positionType?: 'race' | 'back_game' | 'prime_game' | 'mixed'; // Тип позиции
  moveMetrics?: {
    distributionChange?: number;
    timingChange?: number;
    flexibilityChange?: number;
    structureChange?: number;
    riskChange?: number;
    diceEfficiency?: number;
    strategicValue?: number;
  };
  alternatives?: Array<{
    moves: Array<{ from: number; to: number; die: number }>;
    equity: number;
    isCurrent?: boolean;
    diff?: number;
    quality?: number;
  }>;
  gptAnalysis?: {
    evaluation: 'excellent' | 'good' | 'neutral' | 'inaccuracy' | 'mistake' | 'blunder';
    explanation: string;
    reasoning: string;
    recommendations?: string[];
  };
}

export interface GameAnalysis {
  gameId: string;
  totalMoves: number;
  allMoves: MoveAnalysis[]; // Все ходы
  errors: MoveAnalysis[]; // Только ошибки
  mistakes: number;
  blunders: number;
  inaccuracies: number;
  recommendations: string[];
  gameResult?: 'win' | 'loss';
}

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameMove)
    private movesRepository: Repository<GameMove>,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
    private backgammonEngine: BackgammonEngine,
    private longBackgammonEngine: LongBackgammonEngine,
    @Optional() private gptBotService?: GptBotService,
  ) {}

  /**
   * Анализ игры для премиум пользователей
   * Находит ошибки в ходах и дает рекомендации
   */
  async analyzeGame(userId: string, gameId: string): Promise<GameAnalysis> {
    // Проверяем доступ пользователя к игре
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['player1', 'player2'],
    });

    if (!game) {
      throw new Error('Игра не найдена');
    }

    if (game.player1Id !== userId && game.player2Id !== userId) {
      throw new ForbiddenException('Нет доступа к этой игре');
    }

    // Проверяем премиум подписку (отключено для теста по запросу пользователя)
    /*
    const hasPremium = await this.subscriptionService.hasActiveSubscription(userId);
    if (!hasPremium) {
      throw new ForbiddenException('Анализ игр доступен только для премиум пользователей');
    }
    */

    // Загружаем все ходы
    const moves = await this.movesRepository.find({
      where: { gameId },
      order: { moveNumber: 'ASC' },
      relations: ['player'],
    });

    // Определяем правильный движок в зависимости от режима игры
    const isShortMode = game.mode === GameMode.SHORT;
    const engine = isShortMode ? this.backgammonEngine : this.longBackgammonEngine;
    const errors: MoveAnalysis[] = [];
    const allMovesAnalysis: MoveAnalysis[] = [];

    // Анализируем каждый ход
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isUserMove = move.playerId === userId;
      
      // Даже если это не ход пользователя, мы можем захотеть его показать в общем списке, 
      // но анализ (ошибки) делаем только для пользователя.
      
      const gameStateBefore = move.gameStateBefore;
      const gameStateAfter = move.gameStateAfter;

      // Определяем, является ли это первым ходом игры
      // Для длинных нард: первые 2 хода (по одному от каждого игрока)
      // Для коротких нард: первый ход
      const isFirstMoveOfGame = isShortMode 
        ? move.moveNumber === 1 
        : move.moveNumber <= 2;

      // Находим все возможные ходы для этой позиции, чтобы показать альтернативы
      // Используем состояние игры как seed для детерминированного перемешивания
      // Для длинных нард передаем isFirstMoveOfGame для правильной обработки правил головы
      const stateSeed = JSON.stringify(gameStateBefore.points) + JSON.stringify(move.dice) + gameStateBefore.currentPlayer;
      const allPossibleMovesSequences = isShortMode
        ? engine.getAllValidMoves(gameStateBefore, move.dice)
        : engine.getAllValidMoves(gameStateBefore, move.dice, isFirstMoveOfGame, stateSeed);
      // Оцениваем все альтернативные ходы эвристикой
      let evaluatedAlternatives: Array<{
        moves: Array<{ from: number; to: number; die: number }>;
        equity: number;
        isCurrent?: boolean;
        diff?: number;
      }> = allPossibleMovesSequences.map(mSeq => {
        let testState = { ...gameStateBefore };
        for (const m of mSeq) {
          testState = engine.applyMove(testState, m.from, m.to, m.die);
        }
        const equity = this.evaluatePosition(engine, testState, userId === game.player1Id ? 0 : 1, game.mode);
        return {
          moves: mSeq,
          equity: equity,
        };
      }).sort((a, b) => b.equity - a.equity);
      
      // Группируем по equity и оставляем только уникальные значения equity (берем первый вариант из каждой группы)
      const uniqueEquityAlternatives: Array<{
        moves: Array<{ from: number; to: number; die: number }>;
        equity: number;
        isCurrent?: boolean;
        diff?: number;
      }> = [];
      const seenEquities = new Set<number>();
      
      for (const alt of evaluatedAlternatives) {
        // Округляем equity до 3 знаков для сравнения
        const equityKey = Math.round(alt.equity * 1000) / 1000;
        if (!seenEquities.has(equityKey)) {
          seenEquities.add(equityKey);
          uniqueEquityAlternatives.push(alt);
          // Ограничиваем максимум 6 уникальными вариантами
          if (uniqueEquityAlternatives.length >= 6) break;
        }
      }
      
      const evaluatedAlternativesFiltered = uniqueEquityAlternatives;

      // Оцениваем позицию до и после хода
      const equityBefore = this.evaluatePosition(engine, gameStateBefore, userId === game.player1Id ? 0 : 1, game.mode);
      const equityAfter = this.evaluatePosition(engine, gameStateAfter, userId === game.player1Id ? 0 : 1, game.mode);
      
      const equity = equityAfter;
      const bestAlternative = evaluatedAlternativesFiltered[0];
      const bestEquity = bestAlternative ? bestAlternative.equity : equityBefore;
      
      // Добавляем текущий ход в альтернативы если его там нет (для сравнения)
      const currentMoveInAlts = evaluatedAlternativesFiltered.find(alt => 
        JSON.stringify(alt.moves) === JSON.stringify(move.moves)
      );
      
      if (!currentMoveInAlts) {
        evaluatedAlternativesFiltered.push({
          moves: move.moves as any,
          equity: equity,
          isCurrent: true
        });
        evaluatedAlternativesFiltered.sort((a, b) => b.equity - a.equity);
        // После добавления текущего хода, снова фильтруем по уникальным equity
        const reFiltered: typeof evaluatedAlternativesFiltered = [];
        const reSeenEquities = new Set<number>();
        for (const alt of evaluatedAlternativesFiltered) {
          const equityKey = Math.round(alt.equity * 1000) / 1000;
          if (!reSeenEquities.has(equityKey) || alt.isCurrent) {
            reSeenEquities.add(equityKey);
            reFiltered.push(alt);
            if (reFiltered.length >= 6 && !alt.isCurrent) break;
          }
        }
        evaluatedAlternativesFiltered.length = 0;
        evaluatedAlternativesFiltered.push(...reFiltered);
        evaluatedAlternativesFiltered.sort((a, b) => b.equity - a.equity);
      } else {
        currentMoveInAlts.isCurrent = true;
      }

      // Расчитываем разницу (diff) для каждой альтернативы относительно лучшей
      const maxEquity = evaluatedAlternativesFiltered[0]?.equity || 0;
      evaluatedAlternativesFiltered.forEach(alt => {
        alt.diff = alt.equity - maxEquity;
      });

      const missedEquity = bestEquity - equity;

      // Определяем, является ли текущий ход лучшим (diff === 0 или очень близок, погрешность < 0.001)
      const currentMoveDiff = evaluatedAlternativesFiltered.find(alt => alt.isCurrent)?.diff || 999;
      const isBestMove = Math.abs(currentMoveDiff) < 0.001;

      // Рассчитываем вероятности выигрыша на основе equity и позиционных факторов
      const winProbabilities = this.calculateWinProbabilities(equity, gameStateAfter, userId === game.player1Id ? 0 : 1, game.mode);

      // Определяем playerIndex для текущего хода
      const currentPlayerIndex = userId === game.player1Id ? 0 : 1;

      // Оцениваем качество хода на основе позиционных и стратегических факторов
      const moveQuality = this.evaluateMoveQuality(
        engine,
        gameStateBefore,
        gameStateAfter,
        move.moves as any,
        bestAlternative?.moves || [],
        currentPlayerIndex,
        game.mode
      );

      // Определяем тип ошибки на основе комбинации упущенной equity и качества хода
      // Используем более сложную систему оценки, как в шахматах
      // НЕ показываем ошибки на первых ходах - там все ходы примерно равны
      let isError = false;
      let errorType: 'blunder' | 'mistake' | 'inaccuracy' | undefined;
      let errorDescription: string | undefined;

      // Пропускаем анализ ошибок для первых ходов игры
      // Для коротких нард: первый ход (moveNumber === 1)
      // Для длинных нард: первые 2 хода (moveNumber <= 2)
      const shouldAnalyzeErrors = !isFirstMoveOfGame && isUserMove;

      // GPT анализ хода (если доступен)
      let gptAnalysis: MoveAnalysis['gptAnalysis'] = null;
      if (this.gptBotService && shouldAnalyzeErrors && isUserMove) {
        try {
          gptAnalysis = await this.gptBotService.analyzeMove(
            gameStateBefore,
            gameStateAfter,
            move.moves as any,
            move.dice,
            game.mode === GameMode.LONG ? 'long' : 'short',
            bestAlternative?.moves,
          );
        } catch (error) {
          // Если GPT недоступен - используем эвристику
        }
      }

      // Используем GPT анализ для определения ошибок, если он доступен
      // Иначе используем эвристику
      if (gptAnalysis) {
        // GPT определил оценку хода
        if (gptAnalysis.evaluation === 'blunder' || gptAnalysis.evaluation === 'mistake' || gptAnalysis.evaluation === 'inaccuracy') {
          isError = true;
          errorType = gptAnalysis.evaluation;
          // Используем объяснение GPT, добавляя рекомендации если есть
          let description = gptAnalysis.explanation || gptAnalysis.reasoning || '';
          if (gptAnalysis.reasoning && gptAnalysis.reasoning !== description) {
            description += '. ' + gptAnalysis.reasoning;
          }
          if (bestAlternative && gptAnalysis.recommendations && gptAnalysis.recommendations.length > 0) {
            description += '. ' + gptAnalysis.recommendations.join('. ');
          } else if (bestAlternative) {
            const bestMoveDescription = this.describeMove(bestAlternative.moves, game.mode);
            description += `. Правильный ход: ${bestMoveDescription}`;
          }
          errorDescription = description;
        }
      } else {
        // Используем эвристику как fallback
        const combinedScore = missedEquity * 0.7 + (1 - moveQuality) * 0.3;

        if (shouldAnalyzeErrors && (combinedScore > 0.12 || (missedEquity > 0.10 && moveQuality < 0.3))) {
          isError = true;
          errorType = 'blunder';
          const reasons = this.getMoveQualityReasons(
            engine,
            gameStateBefore,
            gameStateAfter,
            move.moves as any,
            bestAlternative?.moves || [],
            currentPlayerIndex,
            game.mode,
            bestEquity - equity
          );
          const bestMoveDescription = bestAlternative ? this.describeMove(bestAlternative.moves, game.mode) : '';
          errorDescription = `Грубая ошибка${reasons ? ': ' + reasons : ''}${bestMoveDescription ? '. Правильный ход: ' + bestMoveDescription : ''}`;
        } else if (shouldAnalyzeErrors && (combinedScore > 0.06 || (missedEquity > 0.05 && moveQuality < 0.5))) {
          isError = true;
          errorType = 'mistake';
          const reasons = this.getMoveQualityReasons(
            engine,
            gameStateBefore,
            gameStateAfter,
            move.moves as any,
            bestAlternative?.moves || [],
            currentPlayerIndex,
            game.mode,
            bestEquity - equity
          );
          const bestMoveDescription = bestAlternative ? this.describeMove(bestAlternative.moves, game.mode) : '';
          errorDescription = `Ошибка${reasons ? ': ' + reasons : ''}${bestMoveDescription ? '. Правильный ход: ' + bestMoveDescription : ''}`;
        } else if (shouldAnalyzeErrors && (combinedScore > 0.03 || (missedEquity > 0.02 && moveQuality < 0.7))) {
          isError = true;
          errorType = 'inaccuracy';
          const reasons = this.getMoveQualityReasons(
            engine,
            gameStateBefore,
            gameStateAfter,
            move.moves as any,
            bestAlternative?.moves || [],
            currentPlayerIndex,
            game.mode,
            bestEquity - equity
          );
          const bestMoveDescription = bestAlternative ? this.describeMove(bestAlternative.moves, game.mode) : '';
          errorDescription = `Неточность${reasons ? ': ' + reasons : ''}${bestMoveDescription ? '. Лучший ход: ' + bestMoveDescription : ''}`;
        }
      }

      // Определяем тип позиции
      const positionType = this.determinePositionType(gameStateAfter, userId === game.player1Id ? 0 : 1, game.mode);

      // Рассчитываем метрики хода
      const moveMetrics = {
        distributionChange: this.evaluateDistribution(gameStateAfter, userId === game.player1Id ? 0 : 1, game.mode) - 
                          this.evaluateDistribution(gameStateBefore, userId === game.player1Id ? 0 : 1, game.mode),
        timingChange: this.evaluateTiming(gameStateAfter, userId === game.player1Id ? 0 : 1, game.mode) - 
                     this.evaluateTiming(gameStateBefore, userId === game.player1Id ? 0 : 1, game.mode),
        flexibilityChange: this.evaluateFlexibility(gameStateAfter, userId === game.player1Id ? 0 : 1, game.mode) - 
                          this.evaluateFlexibility(gameStateBefore, userId === game.player1Id ? 0 : 1, game.mode),
        structureChange: this.evaluateBoardStructure(gameStateAfter, userId === game.player1Id ? 0 : 1, game.mode) - 
                        this.evaluateBoardStructure(gameStateBefore, userId === game.player1Id ? 0 : 1, game.mode),
        riskChange: this.evaluateRisk(gameStateAfter, userId === game.player1Id ? 0 : 1, game.mode) - 
                   this.evaluateRisk(gameStateBefore, userId === game.player1Id ? 0 : 1, game.mode),
        diceEfficiency: this.evaluateDiceEfficiency(move.moves as any, gameStateBefore, gameStateAfter, userId === game.player1Id ? 0 : 1),
        strategicValue: this.evaluateStrategicValue(gameStateBefore, gameStateAfter, userId === game.player1Id ? 0 : 1, game.mode),
      };

      // Добавляем качество к альтернативам
      evaluatedAlternativesFiltered.forEach((alt: any) => {
        if (alt.moves) {
          // Упрощенная оценка качества альтернативы
          alt.quality = 0.7; // Базовое качество, можно улучшить
        }
      });

      const analysis: MoveAnalysis = {
        moveNumber: move.moveNumber,
        move,
        isError,
        errorType,
        errorDescription,
        isBestMove,
        bestMove: bestAlternative?.moves,
        scoreChange: -missedEquity * 100, // Конвертируем в старую шкалу для обратной совместимости
        gptAnalysis: gptAnalysis || undefined,
        equity,
        winProbabilities,
        moveQuality,
        positionType,
        moveMetrics,
        alternatives: evaluatedAlternativesFiltered,
      };

      allMovesAnalysis.push(analysis);
      if (isError && isUserMove) {
        errors.push(analysis);
      }
    }

    // Генерируем рекомендации
    const recommendations = this.generateRecommendations(errors, game.mode);

    return {
      gameId,
      totalMoves: moves.length,
      allMoves: allMovesAnalysis,
      errors,
      mistakes: errors.filter((e) => e.errorType === 'mistake').length,
      blunders: errors.filter((e) => e.errorType === 'blunder').length,
      inaccuracies: errors.filter((e) => e.errorType === 'inaccuracy').length,
      recommendations,
      gameResult: game.winnerId === userId ? 'win' : 'loss',
    };
  }

  /**
   * Расчет пип-каунта (pip count) - расстояния всех шашек до финиша
   */
  private calculatePipCount(gameState: any, playerIndex: number, mode: string): number {
    const points = gameState.points || [];
    const bar = Array.isArray(gameState.bar) ? gameState.bar : [gameState.bar?.white || 0, gameState.bar?.black || 0];
    
    let pipCount = 0;
    const isLong = mode === 'long' || mode === 'LONG';

    if (playerIndex === 0) {
      // Белые игроки
      points.forEach((val, idx) => {
        if (val > 0) {
          if (isLong) {
            // В длинных: белые идут от 0 (точка 24) к 23 (точка 1)
            // Расстояние = 24 - idx
            pipCount += val * (24 - idx);
          } else {
            // В коротких: белые идут от точки 24 к дому (точки 19-24, индексы 18-23)
            // Дом для белых: точки 1-6 (индексы 23, 22, 21, 20, 19, 18)
            // Расстояние от точки idx до дома
            if (idx >= 18) {
              // Уже в доме, расстояние = 0 (но считаем как есть, т.к. нужно вывести)
              pipCount += val * (24 - idx);
            } else {
              // Вне дома, расстояние до дома + расстояние в доме
              const distanceToHome = 24 - idx;
              pipCount += val * distanceToHome;
            }
          }
        }
      });
      
      // Шашки на баре добавляют максимальное расстояние (нужно войти на точку 24, потом дойти до дома)
      pipCount += bar[0] * 25; // 24 для входа + 1 для пути в доме
      
    } else {
      // Черные игроки
      points.forEach((val, idx) => {
        if (val < 0) {
          const checkerCount = Math.abs(val);
          if (isLong) {
            // В длинных: черные идут от 12 (точка 12) к 0 (точка 24), затем к 23 (точка 1)
            // Голова черных на точке 12 (индекс 12)
            if (idx <= 12) {
              // От головы к точке 24
              const dist = 12 - idx;
              pipCount += checkerCount * dist;
            } else {
              // От точки 24 к точке 1
              const dist = (24 - idx) + 12;
              pipCount += checkerCount * dist;
            }
          } else {
            // В коротких: черные идут от точки 1 к дому (точки 1-6, индексы 0-5)
            // Дом для черных: точки 1-6 (индексы 0, 1, 2, 3, 4, 5)
            if (idx < 6) {
              // Уже в доме
              pipCount += checkerCount * (idx + 1);
            } else {
              // Вне дома, расстояние до дома
              const distanceToHome = idx + 1;
              pipCount += checkerCount * distanceToHome;
            }
          }
        }
      });
      
      // Шашки на баре (для черных нужно войти на точку 1, потом дойти до дома)
      pipCount += bar[1] * 7; // 6 для входа на точку 1 + 1 для пути в доме
    }

    return pipCount;
  }

  /**
   * Профессиональная оценка позиции на основе множества факторов (как в шахматах)
   * Возвращает equity в диапазоне примерно от -2 до +2 (где 1 = победа в обычную игру)
   * Использует расширенный анализ: race, back game, distribution, timing, flexibility и многое другое
   */
  private evaluatePosition(engine: any, gameState: any, playerIndex: number, mode: string = 'long'): number {
    const points = gameState.points || [];
    const bar = Array.isArray(gameState.bar) ? gameState.bar : [gameState.bar?.white || 0, gameState.bar?.black || 0];
    const borneOff = Array.isArray(gameState.borneOff) 
      ? gameState.borneOff 
      : [gameState.borneOff?.white || 0, gameState.borneOff?.black || 0];
    
    const opponentIndex = 1 - playerIndex;
    const isLong = mode === 'long' || mode === 'LONG';

    // 1. Расчет пип-каунтов (основной фактор)
    const myPipCount = this.calculatePipCount(gameState, playerIndex, mode);
    const opponentPipCount = this.calculatePipCount(gameState, opponentIndex, mode);
    const pipDiff = opponentPipCount - myPipCount;
    
    // Определяем тип позиции для более точного коэффициента
    const positionType = this.determinePositionType(gameState, playerIndex, mode);
    
    // Более точные коэффициенты в зависимости от типа позиции
    // В race позиции: ~0.012-0.015 equity за пип
    // В сложных позициях: ~0.008-0.010 equity за пип
    let pipCoefficient = 0.01; // Базовый коэффициент
    if (positionType === 'race') {
      pipCoefficient = 0.013; // В гонке пип-каунт более важен
    } else if (positionType === 'back_game') {
      pipCoefficient = 0.008; // В back game пип-каунт менее важен чем позиция
    } else if (positionType === 'prime_game') {
      pipCoefficient = 0.009; // В prime game позиция важнее пип-каунта
    }
    
    // Конвертируем разницу пип-каунтов в equity с учетом типа позиции
    let equity = pipDiff * pipCoefficient;

    // 2. Проверка на завершение игры
    const myBorneOff = borneOff[playerIndex];
    const opponentBorneOff = borneOff[opponentIndex];
    
    if (myBorneOff >= 15) {
      // Игра закончена - победа
      if (opponentBorneOff === 0) {
        return 2.0; // Бэкгаммон (оппонент ничего не вывел)
      } else if (opponentBorneOff < 15) {
        return 1.5; // Гаммон (оппонент не закончил)
      } else {
        return 1.0; // Обычная победа
      }
    }
    
    if (opponentBorneOff >= 15) {
      // Поражение
      if (myBorneOff === 0) {
        return -2.0; // Бэкгаммон
      } else if (myBorneOff < 15) {
        return -1.5; // Гаммон
      } else {
        return -1.0; // Обычное поражение
      }
    }

    // 3. Шашки на баре (большой штраф)
    const myBarCount = bar[playerIndex];
    const opponentBarCount = bar[opponentIndex];
    equity -= myBarCount * 0.15;
    equity += opponentBarCount * 0.15;

    // 4. Контроль доски (прима, блокировки)
    let myPoints = 0; // Количество собственных точек (2+ шашек)
    let opponentPoints = 0;
    let myPrimeLength = 0; // Длина примы (последовательных точек)
    let maxPrimeLength = 0;
    let currentPrimeLength = 0;

    if (playerIndex === 0) {
      for (let i = 0; i < 24; i++) {
        if (points[i] >= 2) {
          myPoints++;
          currentPrimeLength++;
          maxPrimeLength = Math.max(maxPrimeLength, currentPrimeLength);
        } else {
          currentPrimeLength = 0;
        }
      }
      myPrimeLength = maxPrimeLength;
      
      maxPrimeLength = 0;
      currentPrimeLength = 0;
      for (let i = 0; i < 24; i++) {
        if (points[i] <= -2) {
          opponentPoints++;
          currentPrimeLength++;
          maxPrimeLength = Math.max(maxPrimeLength, currentPrimeLength);
        } else {
          currentPrimeLength = 0;
        }
      }
    } else {
      for (let i = 0; i < 24; i++) {
        if (points[i] <= -2) {
          myPoints++;
          currentPrimeLength++;
          maxPrimeLength = Math.max(maxPrimeLength, currentPrimeLength);
        } else {
          currentPrimeLength = 0;
        }
      }
      myPrimeLength = maxPrimeLength;
      
      maxPrimeLength = 0;
      currentPrimeLength = 0;
      for (let i = 0; i < 24; i++) {
        if (points[i] >= 2) {
          opponentPoints++;
          currentPrimeLength++;
          maxPrimeLength = Math.max(maxPrimeLength, currentPrimeLength);
        } else {
          currentPrimeLength = 0;
        }
      }
    }

    // Бонус за контроль доски
    equity += (myPoints - opponentPoints) * 0.02;
    
    // Бонус за приму (блокировка оппонента)
    if (myPrimeLength >= 4) {
      equity += (myPrimeLength - 3) * 0.05; // Прима из 4+ точек очень ценна
    }

    // 5. Близость к дому (чем ближе к выводу, тем лучше)
    const homeBoardStart = playerIndex === 0 ? 18 : 0;
    const homeBoardEnd = playerIndex === 0 ? 23 : 5;
    let myHomeCheckers = 0;
    let opponentHomeCheckers = 0;

    for (let i = homeBoardStart; i <= homeBoardEnd; i++) {
      if (playerIndex === 0 && points[i] > 0) {
        myHomeCheckers += points[i];
      } else if (playerIndex === 1 && points[i] < 0) {
        myHomeCheckers += Math.abs(points[i]);
      }
      
      if (opponentIndex === 0 && points[i] > 0) {
        opponentHomeCheckers += points[i];
      } else if (opponentIndex === 1 && points[i] < 0) {
        opponentHomeCheckers += Math.abs(points[i]);
      }
    }

    equity += (myHomeCheckers - opponentHomeCheckers) * 0.01;

    // 6. Одиночные шашки (блоты) - риск
    let myBlots = 0;
    let opponentBlots = 0;

    for (let i = 0; i < 24; i++) {
      if (playerIndex === 0 && points[i] === 1) {
        myBlots++;
      } else if (playerIndex === 1 && points[i] === -1) {
        myBlots++;
      }
      
      if (opponentIndex === 0 && points[i] === 1) {
        opponentBlots++;
      } else if (opponentIndex === 1 && points[i] === -1) {
        opponentBlots++;
      }
    }

    equity -= (myBlots - opponentBlots) * 0.03;

    // 7. РАСПРЕДЕЛЕНИЕ ШАШЕК (Distribution) - оценка эффективности размещения
    const distributionScore = this.evaluateDistribution(gameState, playerIndex, mode);
    equity += distributionScore * 0.05;

    // 8. TIMING (Время для атаки/защиты) - критический фактор в нардах
    const timingScore = this.evaluateTiming(gameState, playerIndex, mode);
    equity += timingScore * 0.08;

    // 9. FLEXIBILITY (Гибкость позиции) - сколько вариантов ходов доступно
    const flexibilityScore = this.evaluateFlexibility(gameState, playerIndex, mode);
    equity += flexibilityScore * 0.04;

    // 10. BACK GAME оценка (позиция с шашками в доме противника)
    const backGameScore = this.evaluateBackGame(gameState, playerIndex, mode);
    equity += backGameScore * 0.06;

    // 11. RACE оценка (гонка к финишу)
    const raceScore = this.evaluateRace(gameState, playerIndex, mode);
    equity += raceScore * 0.07;

    // 12. СТРУКТУРА ДОСКИ (Board Structure) - оценка качества построения
    const structureScore = this.evaluateBoardStructure(gameState, playerIndex, mode);
    equity += structureScore * 0.05;

    // 13. ОЦЕНКА РИСКОВ (Risk Assessment) - вероятность быть побитым
    const riskScore = this.evaluateRisk(gameState, playerIndex, mode);
    equity += riskScore * 0.04;

    // 14. ОЦЕНКА КОНТРОЛЯ КЛЮЧЕВЫХ ТОЧЕК (Key Points Control)
    const keyPointsScore = this.evaluateKeyPoints(gameState, playerIndex, mode);
    equity += keyPointsScore * 0.06;

    // 15. ОЦЕНКА МОБИЛЬНОСТИ (Mobility) - способность делать эффективные ходы
    const mobilityScore = this.evaluateMobility(gameState, playerIndex, mode);
    equity += mobilityScore * 0.03;

    // 16. ОЦЕНКА ПОТЕНЦИАЛА ГАММОНА/БЭКГАММОНА
    const gammonPotential = this.evaluateGammonPotential(gameState, playerIndex, mode);
    equity += gammonPotential * 0.1;

    return equity;
  }

  /**
   * Оценка распределения шашек (Distribution)
   * Хорошее распределение = шашки равномерно распределены, нет скоплений
   */
  private evaluateDistribution(gameState: any, playerIndex: number, mode: string): number {
    const points = gameState.points || [];
    let score = 0;
    let myCheckers = 0;
    let myPoints = 0;

    // Считаем количество шашек и занятых точек
    for (let i = 0; i < 24; i++) {
      if (playerIndex === 0 && points[i] > 0) {
        myCheckers += points[i];
        if (points[i] >= 2) myPoints++;
      } else if (playerIndex === 1 && points[i] < 0) {
        myCheckers += Math.abs(points[i]);
        if (points[i] <= -2) myPoints++;
      }
    }

    // Хорошее распределение: много точек с 2-3 шашками, мало с 4+
    let overStacked = 0; // Точки с 4+ шашками
    let wellStacked = 0; // Точки с 2-3 шашками

    for (let i = 0; i < 24; i++) {
      const count = playerIndex === 0 ? points[i] : Math.abs(points[i]);
      if (count >= 4) overStacked++;
      else if (count >= 2 && count <= 3) wellStacked++;
    }

    // Бонус за хорошее распределение, штраф за перегруженные точки
    score = (wellStacked * 0.5) - (overStacked * 0.3);
    
    return score;
  }

  /**
   * Оценка Timing - критический фактор в нардах
   * Timing определяет, есть ли у игрока время для атаки или нужно защищаться
   * Улучшенная версия с учетом контекста позиции
   */
  private evaluateTiming(gameState: any, playerIndex: number, mode: string): number {
    const points = gameState.points || [];
    const borneOff = Array.isArray(gameState.borneOff) 
      ? gameState.borneOff 
      : [gameState.borneOff?.white || 0, gameState.borneOff?.black || 0];
    
    const myBorneOff = borneOff[playerIndex];
    const opponentBorneOff = borneOff[1 - playerIndex];
    const myPipCount = this.calculatePipCount(gameState, playerIndex, mode);
    const opponentPipCount = this.calculatePipCount(gameState, 1 - playerIndex, mode);
    
    // Если уже выводим шашки, timing не так важен (race позиция)
    if (myBorneOff >= 10) {
      return 0;
    }

    // Считаем шашки в доме противника (back game)
    const opponentHomeStart = playerIndex === 0 ? 0 : 18;
    const opponentHomeEnd = playerIndex === 0 ? 5 : 23;
    let backCheckers = 0;
    let backAnchors = 0; // Якоря в доме противника

    for (let i = opponentHomeStart; i <= opponentHomeEnd; i++) {
      if (playerIndex === 0 && points[i] > 0) {
        backCheckers += points[i];
        if (points[i] >= 2) backAnchors++;
      } else if (playerIndex === 1 && points[i] < 0) {
        backCheckers += Math.abs(points[i]);
        if (points[i] <= -2) backAnchors++;
      }
    }

    // Улучшенная оценка timing с учетом контекста
    let timingScore = 0;
    
    // Хороший timing: есть якоря в доме противника (2-3 якоря идеально)
    // Это дает возможность атаковать, не теряя позицию
    if (backAnchors >= 2 && backAnchors <= 3 && backCheckers <= 8) {
      timingScore = 0.6; // Отличный timing для атаки
    } else if (backAnchors === 1 && backCheckers <= 6) {
      timingScore = 0.3; // Хороший timing
    } else if (backAnchors === 0 && backCheckers > 0 && backCheckers <= 4) {
      timingScore = 0.1; // Нейтральный timing
    } else if (backCheckers > 8 || backAnchors > 3) {
      timingScore = -0.6; // Плохой timing - слишком много шашек в доме противника
    } else if (backCheckers > 6) {
      timingScore = -0.3; // Слабый timing
    }
    
    // Корректируем timing в зависимости от разницы пип-каунтов
    // Если мы впереди по пипам, timing менее критичен
    const pipLead = myPipCount < opponentPipCount ? (opponentPipCount - myPipCount) : 0;
    if (pipLead > 15) {
      timingScore *= 0.7; // Timing менее важен если мы далеко впереди
    } else if (pipLead < -15) {
      timingScore *= 1.2; // Timing критичен если мы отстаем
    }
    
    // В длинных нардах timing более важен из-за правил головы
    if (mode === 'long' || mode === 'LONG') {
      timingScore *= 1.1;
    }

    return Math.max(-1, Math.min(1, timingScore));
  }

  /**
   * Оценка гибкости позиции (Flexibility)
   * Гибкость = сколько различных эффективных ходов можно сделать
   */
  private evaluateFlexibility(gameState: any, playerIndex: number, mode: string): number {
    const points = gameState.points || [];
    let flexibility = 0;

    // Считаем количество точек с шашками (больше точек = больше гибкости)
    let myPointsWithCheckers = 0;
    for (let i = 0; i < 24; i++) {
      if (playerIndex === 0 && points[i] > 0) {
        myPointsWithCheckers++;
      } else if (playerIndex === 1 && points[i] < 0) {
        myPointsWithCheckers++;
      }
    }

    // Больше точек с шашками = больше гибкости
    flexibility = (myPointsWithCheckers - 6) * 0.1; // Нормализуем относительно среднего

    // Штраф за шашки на баре (меньше гибкости)
    const bar = Array.isArray(gameState.bar) ? gameState.bar : [gameState.bar?.white || 0, gameState.bar?.black || 0];
    const myBarCount = bar[playerIndex];
    flexibility -= myBarCount * 0.2;

    return Math.max(-1, Math.min(1, flexibility));
  }

  /**
   * Оценка Back Game (позиция с шашками в доме противника)
   */
  private evaluateBackGame(gameState: any, playerIndex: number, mode: string): number {
    const points = gameState.points || [];
    const opponentHomeStart = playerIndex === 0 ? 0 : 18;
    const opponentHomeEnd = playerIndex === 0 ? 5 : 23;
    
    let backCheckers = 0;
    let anchors = 0;

    for (let i = opponentHomeStart; i <= opponentHomeEnd; i++) {
      if (playerIndex === 0 && points[i] > 0) {
        backCheckers += points[i];
        if (points[i] >= 2) anchors++;
      } else if (playerIndex === 1 && points[i] < 0) {
        backCheckers += Math.abs(points[i]);
        if (points[i] <= -2) anchors++;
      }
    }

    // Back game может быть хорошим, если есть якоря и не слишком много шашек
    if (backCheckers >= 2 && backCheckers <= 6 && anchors >= 1) {
      return 0.3; // Умеренный back game с якорем
    } else if (backCheckers > 6) {
      return -0.5; // Слишком много шашек в доме противника
    }

    return 0;
  }

  /**
   * Оценка Race (гонка к финишу)
   */
  private evaluateRace(gameState: any, playerIndex: number, mode: string): number {
    const myPipCount = this.calculatePipCount(gameState, playerIndex, mode);
    const opponentPipCount = this.calculatePipCount(gameState, 1 - playerIndex, mode);
    const pipDiff = opponentPipCount - myPipCount;

    // В гонке важна разница в пип-каунтах
    // Если разница большая в нашу пользу, это хорошо
    if (pipDiff > 10) {
      return 0.5; // Хорошее преимущество в гонке
    } else if (pipDiff < -10) {
      return -0.5; // Проигрываем в гонке
    }

    return pipDiff * 0.05;
  }

  /**
   * Оценка структуры доски (Board Structure)
   */
  private evaluateBoardStructure(gameState: any, playerIndex: number, mode: string): number {
    const points = gameState.points || [];
    let score = 0;

    // Оценка качества построения призмы
    const primeLength = this.calculatePrimeLength(points, playerIndex);
    if (primeLength >= 6) {
      score += 0.5; // Отличная призма
    } else if (primeLength >= 4) {
      score += 0.3; // Хорошая призма
    }

    // Оценка качества построения дома
    const homeStart = playerIndex === 0 ? 18 : 0;
    const homeEnd = playerIndex === 0 ? 23 : 5;
    let homePoints = 0;
    let homeGaps = 0;

    for (let i = homeStart; i <= homeEnd; i++) {
      const hasChecker = (playerIndex === 0 && points[i] > 0) || (playerIndex === 1 && points[i] < 0);
      if (hasChecker && ((playerIndex === 0 && points[i] >= 2) || (playerIndex === 1 && points[i] <= -2))) {
        homePoints++;
      } else if (!hasChecker) {
        homeGaps++;
      }
    }

    // Хорошая структура дома: много точек с шашками, мало пробелов
    score += (homePoints - homeGaps) * 0.1;

    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Оценка рисков (Risk Assessment)
   */
  private evaluateRisk(gameState: any, playerIndex: number, mode: string): number {
    const points = gameState.points || [];
    let risk = 0;

    const isLong = mode === 'long' || mode === 'LONG';
    
    // Риск от блотов - ТОЛЬКО для коротких нард
    if (!isLong) {
      const blots = this.countBlots(points, playerIndex);
      risk -= blots * 0.15;
    }

    // Риск от шашек на баре
    const bar = Array.isArray(gameState.bar) ? gameState.bar : [gameState.bar?.white || 0, gameState.bar?.black || 0];
    const myBarCount = bar[playerIndex];
    risk -= myBarCount * 0.2;

    // Риск от незащищенных шашек в доме противника - ТОЛЬКО для коротких нард
    if (!isLong) {
      const exposedCheckers = this.countExposedCheckers(points, playerIndex, mode);
      risk -= exposedCheckers * 0.1;
    }
    
    // Для длинных нард: риск от плохого распределения и timing
    if (isLong) {
      const distribution = this.evaluateDistribution(gameState, playerIndex, mode);
      if (distribution < -0.3) {
        risk -= 0.1; // Штраф за плохое распределение
      }
      
      const timing = this.evaluateTiming(gameState, playerIndex, mode);
      if (timing < -0.3) {
        risk -= 0.1; // Штраф за плохой timing
      }
    }

    return Math.max(-1, Math.min(0, risk)); // Риск всегда отрицательный
  }

  /**
   * Оценка контроля ключевых точек
   */
  private evaluateKeyPoints(gameState: any, playerIndex: number, mode: string): number {
    const points = gameState.points || [];
    let score = 0;

    // Ключевые точки в нардах: 5, 7, 13, 18, 20, 24 (в зависимости от режима)
    const keyPoints = mode === 'long' 
      ? [5, 7, 13, 18, 20] // Для длинных нардов
      : [5, 7, 13, 18, 20, 24]; // Для коротких нардов

    for (const point of keyPoints) {
      const idx = point - 1; // Конвертируем в индекс массива
      if (idx >= 0 && idx < 24) {
        const hasControl = (playerIndex === 0 && points[idx] >= 2) || (playerIndex === 1 && points[idx] <= -2);
        if (hasControl) {
          score += 0.1; // Бонус за контроль ключевой точки
        }
      }
    }

    return Math.min(1, score);
  }

  /**
   * Оценка мобильности (Mobility)
   */
  private evaluateMobility(gameState: any, playerIndex: number, mode: string): number {
    const points = gameState.points || [];
    const bar = Array.isArray(gameState.bar) ? gameState.bar : [gameState.bar?.white || 0, gameState.bar?.black || 0];
    
    // Мобильность зависит от количества шашек на баре и распределения
    const myBarCount = bar[playerIndex];
    let mobility = 1.0;

    // Шашки на баре сильно ограничивают мобильность
    mobility -= myBarCount * 0.3;

    // Хорошее распределение увеличивает мобильность
    let pointsWithCheckers = 0;
    for (let i = 0; i < 24; i++) {
      if ((playerIndex === 0 && points[i] > 0) || (playerIndex === 1 && points[i] < 0)) {
        pointsWithCheckers++;
      }
    }
    mobility += (pointsWithCheckers - 8) * 0.05;

    return Math.max(0, Math.min(1, mobility));
  }

  /**
   * Оценка потенциала гаммона/бэкгаммона
   */
  private evaluateGammonPotential(gameState: any, playerIndex: number, mode: string): number {
    const borneOff = Array.isArray(gameState.borneOff) 
      ? gameState.borneOff 
      : [gameState.borneOff?.white || 0, gameState.borneOff?.black || 0];
    
    const myBorneOff = borneOff[playerIndex];
    const opponentBorneOff = borneOff[1 - playerIndex];
    const myPipCount = this.calculatePipCount(gameState, playerIndex, mode);
    const opponentPipCount = this.calculatePipCount(gameState, 1 - playerIndex, mode);

    // Потенциал гаммона: мы далеко впереди, противник еще не начал выводить
    if (myBorneOff >= 5 && opponentBorneOff === 0 && myPipCount < opponentPipCount - 20) {
      return 0.3; // Хороший потенциал гаммона
    }

    // Потенциал бэкгаммона: мы почти закончили, противник ничего не вывел
    if (myBorneOff >= 12 && opponentBorneOff === 0) {
      return 0.5; // Отличный потенциал бэкгаммона
    }

    return 0;
  }

  /**
   * Оценка качества хода на основе позиционных и стратегических факторов
   * Возвращает значение от 0 до 1, где 1 = идеальный ход, 0 = очень плохой ход
   */
  private evaluateMoveQuality(
    engine: any,
    stateBefore: any,
    stateAfter: any,
    currentMove: Array<{ from: number; to: number; die: number }>,
    bestMove: Array<{ from: number; to: number; die: number }>,
    playerIndex: number,
    mode: string
  ): number {
    let quality = 1.0; // Начинаем с идеального хода

    const pointsBefore = stateBefore.points || [];
    const pointsAfter = stateAfter.points || [];
    const barBefore = Array.isArray(stateBefore.bar) ? stateBefore.bar : [stateBefore.bar?.white || 0, stateBefore.bar?.black || 0];
    const barAfter = Array.isArray(stateAfter.bar) ? stateAfter.bar : [stateAfter.bar?.white || 0, stateAfter.bar?.black || 0];

    const isLong = mode === 'long' || mode === 'LONG';
    
    // 1. Проверка безопасности шашек (блоты) - ТОЛЬКО для коротких нард
    if (!isLong) {
      const blotsBefore = this.countBlots(pointsBefore, playerIndex);
      const blotsAfter = this.countBlots(pointsAfter, playerIndex);
      const blotsIncrease = blotsAfter - blotsBefore;
      if (blotsIncrease > 0) {
        quality -= blotsIncrease * 0.15; // Штраф за создание блотов
      } else if (blotsIncrease < 0) {
        quality += Math.abs(blotsIncrease) * 0.1; // Бонус за устранение блотов
      }
    }

    // 2. Проверка вывода шашек с бара
    const barReduction = barBefore[playerIndex] - barAfter[playerIndex];
    if (barReduction > 0) {
      quality += barReduction * 0.2; // Большой бонус за вывод с бара
    }

    // 3. Проверка построения призмы (prime)
    const primeBefore = this.calculatePrimeLength(pointsBefore, playerIndex);
    const primeAfter = this.calculatePrimeLength(pointsAfter, playerIndex);
    if (primeAfter > primeBefore) {
      quality += (primeAfter - primeBefore) * 0.15; // Бонус за увеличение призмы
    }

    // 4. Проверка создания якорей (anchor) - точки с 2+ шашками в доме противника
    const anchorsBefore = this.countAnchors(pointsBefore, playerIndex, mode);
    const anchorsAfter = this.countAnchors(pointsAfter, playerIndex, mode);
    if (anchorsAfter > anchorsBefore) {
      quality += (anchorsAfter - anchorsBefore) * 0.1; // Бонус за создание якорей
    }

    // 5. Проверка блокировки противника
    const opponentBlockedBefore = this.countBlockedPoints(pointsBefore, 1 - playerIndex);
    const opponentBlockedAfter = this.countBlockedPoints(pointsAfter, 1 - playerIndex);
    if (opponentBlockedAfter > opponentBlockedBefore) {
      quality += (opponentBlockedAfter - opponentBlockedBefore) * 0.12; // Бонус за блокировку
    }

    // 6. Проверка продвижения к дому
    const homeProgressBefore = this.calculateHomeProgress(pointsBefore, playerIndex, mode);
    const homeProgressAfter = this.calculateHomeProgress(pointsAfter, playerIndex, mode);
    if (homeProgressAfter > homeProgressBefore) {
      quality += (homeProgressAfter - homeProgressBefore) * 0.08; // Бонус за продвижение
    }

    // 7. Штраф за оставление шашек в опасности (одиночные шашки в доме противника) - ТОЛЬКО для коротких нард
    if (!isLong) {
      const exposedCheckers = this.countExposedCheckers(pointsAfter, playerIndex, mode);
      if (exposedCheckers > 0) {
        quality -= exposedCheckers * 0.1; // Штраф за незащищенные шашки
      }
    }

    // 8. Оценка изменения распределения шашек
    const distributionBefore = this.evaluateDistribution(stateBefore, playerIndex, mode);
    const distributionAfter = this.evaluateDistribution(stateAfter, playerIndex, mode);
    if (distributionAfter > distributionBefore) {
      quality += (distributionAfter - distributionBefore) * 0.1;
    }

    // 9. Оценка изменения timing
    const timingBefore = this.evaluateTiming(stateBefore, playerIndex, mode);
    const timingAfter = this.evaluateTiming(stateAfter, playerIndex, mode);
    if (timingAfter > timingBefore) {
      quality += (timingAfter - timingBefore) * 0.15;
    }

    // 10. Оценка изменения гибкости
    const flexibilityBefore = this.evaluateFlexibility(stateBefore, playerIndex, mode);
    const flexibilityAfter = this.evaluateFlexibility(stateAfter, playerIndex, mode);
    if (flexibilityAfter > flexibilityBefore) {
      quality += (flexibilityAfter - flexibilityBefore) * 0.1;
    }

    // 11. Оценка изменения структуры доски
    const structureBefore = this.evaluateBoardStructure(stateBefore, playerIndex, mode);
    const structureAfter = this.evaluateBoardStructure(stateAfter, playerIndex, mode);
    if (structureAfter > structureBefore) {
      quality += (structureAfter - structureBefore) * 0.12;
    }

    // 12. Оценка изменения контроля ключевых точек
    const keyPointsBefore = this.evaluateKeyPoints(stateBefore, playerIndex, mode);
    const keyPointsAfter = this.evaluateKeyPoints(stateAfter, playerIndex, mode);
    if (keyPointsAfter > keyPointsBefore) {
      quality += (keyPointsAfter - keyPointsBefore) * 0.15;
    }

    // 13. Оценка изменения мобильности
    const mobilityBefore = this.evaluateMobility(stateBefore, playerIndex, mode);
    const mobilityAfter = this.evaluateMobility(stateAfter, playerIndex, mode);
    if (mobilityAfter > mobilityBefore) {
      quality += (mobilityAfter - mobilityBefore) * 0.1;
    }

    // 14. Оценка изменения рисков
    const riskBefore = this.evaluateRisk(stateBefore, playerIndex, mode);
    const riskAfter = this.evaluateRisk(stateAfter, playerIndex, mode);
    if (riskAfter > riskBefore) {
      quality += (riskAfter - riskBefore) * 0.2; // Уменьшение риска очень ценно
    }

    // 15. Оценка эффективности использования кубиков
    const diceEfficiency = this.evaluateDiceEfficiency(currentMove, stateBefore, stateAfter, playerIndex);
    quality += diceEfficiency * 0.1;

    // 16. Оценка стратегической правильности хода
    const strategicValue = this.evaluateStrategicValue(stateBefore, stateAfter, playerIndex, mode);
    quality += strategicValue * 0.15;

    // Нормализуем в диапазон [0, 1]
    return Math.max(0, Math.min(1, quality));
  }

  /**
   * Оценка эффективности использования кубиков (Dice Efficiency)
   * Учитывает wastage - неэффективное использование кубиков
   */
  private evaluateDiceEfficiency(
    move: Array<{ from: number; to: number; die: number }>,
    stateBefore: any,
    stateAfter: any,
    playerIndex: number
  ): number {
    // Считаем использованные очки кубиков
    let usedPips = 0;
    const diceUsed = new Set<number>();
    
    for (const m of move) {
      if (m.from >= 0 && m.to >= 0 && m.to < 24) {
        const distance = Math.abs(m.to - m.from);
        usedPips += distance;
        if (m.die) diceUsed.add(m.die);
      } else if (m.from === -1) {
        // Ход с бара - используем весь кубик
        if (m.die) diceUsed.add(m.die);
        usedPips += m.die || 0;
      } else if (m.to === -1 || m.to >= 24) {
        // Вывод шашки - используем весь кубик
        if (m.die) diceUsed.add(m.die);
        usedPips += m.die || 0;
      }
    }
    
    // Подсчитываем общее количество очков кубиков
    // Предполагаем что move содержит все использованные кубики
    const totalDicePips = Array.from(diceUsed).reduce((sum, die) => sum + die, 0);
    
    // Если не можем определить кубики из move, оцениваем по использованным пипам
    let efficiency = 0;
    if (totalDicePips > 0) {
      // Эффективность = использованные пипы / общие очки кубиков
      efficiency = usedPips / totalDicePips;
    } else {
      // Fallback: оцениваем по среднему использованию
      const expectedEfficiency = 0.75; // Ожидаемая эффективность хорошего хода
      efficiency = Math.min(1, usedPips / 14); // Нормализуем относительно среднего хода
    }
    
    // Wastage (неэффективность) = 1 - efficiency
    // Хорошая эффективность: > 0.8
    // Средняя: 0.6-0.8
    // Плохая: < 0.6
    const wastage = 1 - efficiency;
    
    // Возвращаем оценку: положительное значение = хорошая эффективность
    // Отрицательное = плохая эффективность (wastage)
    return efficiency - 0.75; // Центрируем вокруг 0.75
  }

  /**
   * Оценка стратегической ценности хода
   */
  private evaluateStrategicValue(
    stateBefore: any,
    stateAfter: any,
    playerIndex: number,
    mode: string
  ): number {
    let value = 0;

    // Стратегическая ценность зависит от типа позиции
    const borneOff = Array.isArray(stateAfter.borneOff) 
      ? stateAfter.borneOff 
      : [stateAfter.borneOff?.white || 0, stateAfter.borneOff?.black || 0];
    
    const myBorneOff = borneOff[playerIndex];
    const opponentBorneOff = borneOff[1 - playerIndex];

    // Если мы в гонке (race), стратегия меняется
    if (myBorneOff >= 5 && opponentBorneOff >= 5) {
      // Гонка - важна эффективность вывода
      const pipCountBefore = this.calculatePipCount(stateBefore, playerIndex, mode);
      const pipCountAfter = this.calculatePipCount(stateAfter, playerIndex, mode);
      const pipReduction = pipCountBefore - pipCountAfter;
      if (pipReduction > 0) {
        value += 0.2; // Хорошее продвижение в гонке
      }
    } else if (myBorneOff < 5 && opponentBorneOff < 5) {
      // Ранняя/средняя игра - важна позиция
      const structureAfter = this.evaluateBoardStructure(stateAfter, playerIndex, mode);
      value += structureAfter * 0.3;
    }

    return Math.max(-0.5, Math.min(0.5, value));
  }

  /**
   * Подсчет блотов (одиночных шашек)
   * Блот = одиночная шашка на точке (points[i] === 1 для белых, points[i] === -1 для черных)
   * ВАЖНО: В длинных нардах шашки нельзя бить, поэтому блоты не являются проблемой
   * Эта функция используется только для коротких нард
   */
  private countBlots(points: number[], playerIndex: number): number {
    let count = 0;
    // Проходим по всем 24 точкам доски
    for (let i = 0; i < points.length; i++) {
      // Для белых: блот = одна шашка на точке (points[i] === 1)
      if (playerIndex === 0 && points[i] === 1) {
        count++;
      } 
      // Для черных: блот = одна шашка на точке (points[i] === -1)
      else if (playerIndex === 1 && points[i] === -1) {
        count++;
      }
    }
    return count;
  }

  /**
   * Расчет длины призмы (последовательных точек с 2+ шашками)
   */
  private calculatePrimeLength(points: number[], playerIndex: number): number {
    let maxLength = 0;
    let currentLength = 0;

    for (let i = 0; i < points.length; i++) {
      const hasControl = (playerIndex === 0 && points[i] >= 2) || (playerIndex === 1 && points[i] <= -2);
      if (hasControl) {
        currentLength++;
        maxLength = Math.max(maxLength, currentLength);
      } else {
        currentLength = 0;
      }
    }

    return maxLength;
  }

  /**
   * Подсчет якорей (точек с 2+ шашками в доме противника)
   */
  private countAnchors(points: number[], playerIndex: number, mode: string): number {
    let count = 0;
    const opponentHomeStart = playerIndex === 0 ? 0 : 18;
    const opponentHomeEnd = playerIndex === 0 ? 5 : 23;

    for (let i = opponentHomeStart; i <= opponentHomeEnd; i++) {
      if (playerIndex === 0 && points[i] >= 2) {
        count++;
      } else if (playerIndex === 1 && points[i] <= -2) {
        count++;
      }
    }

    return count;
  }

  /**
   * Подсчет заблокированных точек противника
   */
  private countBlockedPoints(points: number[], opponentIndex: number): number {
    let count = 0;
    for (let i = 0; i < points.length; i++) {
      // Точка заблокирована, если у нас 2+ шашек, а у противника есть шашки на этой точке
      if (opponentIndex === 0 && points[i] > 0 && points[i] < 2) {
        // Противник имеет одиночную шашку, которую мы можем побить
        count++;
      } else if (opponentIndex === 1 && points[i] < 0 && points[i] > -2) {
        count++;
      }
    }
    return count;
  }

  /**
   * Расчет прогресса к дому (сколько шашек уже в доме)
   */
  private calculateHomeProgress(points: number[], playerIndex: number, mode: string): number {
    let progress = 0;
    const homeStart = playerIndex === 0 ? 18 : 0;
    const homeEnd = playerIndex === 0 ? 23 : 5;

    for (let i = homeStart; i <= homeEnd; i++) {
      if (playerIndex === 0 && points[i] > 0) {
        progress += points[i];
      } else if (playerIndex === 1 && points[i] < 0) {
        progress += Math.abs(points[i]);
      }
    }

    return progress;
  }

  /**
   * Подсчет незащищенных шашек в доме противника
   * ВАЖНО: Работает ТОЛЬКО для коротких нард, где можно бить шашки
   * В длинных нардах шашки нельзя бить, поэтому эта функция не должна использоваться
   */
  private countExposedCheckers(points: number[], playerIndex: number, mode: string): number {
    const isLong = mode === 'long' || mode === 'LONG';
    // В длинных нардах шашки нельзя бить, поэтому незащищенных шашек нет
    if (isLong) {
      return 0;
    }
    
    let count = 0;
    const opponentHomeStart = playerIndex === 0 ? 0 : 18;
    const opponentHomeEnd = playerIndex === 0 ? 5 : 23;

    // Для коротких нард: считаем одиночные шашки в доме противника
    // Одиночная шашка = points[i] === 1 (для белых) или points[i] === -1 (для черных)
    for (let i = opponentHomeStart; i <= opponentHomeEnd; i++) {
      if (playerIndex === 0 && points[i] === 1) {
        count++; // Одиночная шашка белых в доме черных
      } else if (playerIndex === 1 && points[i] === -1) {
        count++; // Одиночная шашка черных в доме белых
      }
    }

    return count;
  }

  /**
   * Определение типа позиции
   */
  private determinePositionType(gameState: any, playerIndex: number, mode: string): 'race' | 'back_game' | 'prime_game' | 'mixed' {
    const borneOff = Array.isArray(gameState.borneOff) 
      ? gameState.borneOff 
      : [gameState.borneOff?.white || 0, gameState.borneOff?.black || 0];
    
    const myBorneOff = borneOff[playerIndex];
    const opponentBorneOff = borneOff[1 - playerIndex];

    // Проверяем наличие призмы
    const points = gameState.points || [];
    const primeLength = this.calculatePrimeLength(points, playerIndex);

    // Проверяем наличие шашек в доме противника
    const opponentHomeStart = playerIndex === 0 ? 0 : 18;
    const opponentHomeEnd = playerIndex === 0 ? 5 : 23;
    let backCheckers = 0;
    for (let i = opponentHomeStart; i <= opponentHomeEnd; i++) {
      if (playerIndex === 0 && points[i] > 0) {
        backCheckers += points[i];
      } else if (playerIndex === 1 && points[i] < 0) {
        backCheckers += Math.abs(points[i]);
      }
    }

    if (myBorneOff >= 5 && opponentBorneOff >= 5) {
      return 'race';
    } else if (backCheckers >= 4) {
      return 'back_game';
    } else if (primeLength >= 4) {
      return 'prime_game';
    } else {
      return 'mixed';
    }
  }

  /**
   * Описание хода в понятном формате
   */
  private describeMove(moves: Array<{ from: number; to: number; die: number }>, mode: string): string {
    if (!moves || moves.length === 0) {
      return 'пропуск хода';
    }
    
    const POINT_NUMBERS = [
      24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13,
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ];
    
    const moveDescriptions = moves.map(m => {
      const fromStr = m.from === -1 ? 'бар' : `точка ${POINT_NUMBERS[m.from]}`;
      const toStr = m.to === -1 || m.to >= 24 ? 'вынос' : `точка ${POINT_NUMBERS[m.to]}`;
      return `с ${fromStr} на ${toStr}`;
    });
    
    return moveDescriptions.join(', ');
  }

  /**
   * Получение причин оценки качества хода (для описания ошибок)
   */
  private getMoveQualityReasons(
    engine: any,
    stateBefore: any,
    stateAfter: any,
    currentMove: Array<{ from: number; to: number; die: number }>,
    bestMove: Array<{ from: number; to: number; die: number }>,
    playerIndex: number,
    mode: string,
    missedEquity: number = 0
  ): string {
    const reasons: string[] = [];
    const pointsBefore = stateBefore.points || [];
    const pointsAfter = stateAfter.points || [];
    const barBefore = Array.isArray(stateBefore.bar) ? stateBefore.bar : [stateBefore.bar?.white || 0, stateBefore.bar?.black || 0];
    const barAfter = Array.isArray(stateAfter.bar) ? stateAfter.bar : [stateAfter.bar?.white || 0, stateAfter.bar?.black || 0];
    
    const isLong = mode === 'long' || mode === 'LONG';

    // Для КОРОТКИХ нард: проверяем блоты и незащищенные шашки
    if (!isLong) {
      const blotsIncrease = this.countBlots(pointsAfter, playerIndex) - this.countBlots(pointsBefore, playerIndex);
      if (blotsIncrease > 0) {
        reasons.push(`создано ${blotsIncrease} незащищенных шашек`);
      }

      // Проверяем незащищенные шашки в доме противника (только для коротких)
      const exposedCheckers = this.countExposedCheckers(pointsAfter, playerIndex, mode);
      if (exposedCheckers > 0) {
        reasons.push(`${exposedCheckers} незащищенных шашек в доме противника`);
      }
    }

    // Для ВСЕХ режимов: проверка вывода с бара
    const barReduction = barBefore[playerIndex] - barAfter[playerIndex];
    if (barReduction === 0 && barBefore[playerIndex] > 0) {
      reasons.push('не выведены шашки с бара');
    }

    // Для ВСЕХ режимов: проверка примы
    const primeAfter = this.calculatePrimeLength(pointsAfter, playerIndex);
    const primeBefore = this.calculatePrimeLength(pointsBefore, playerIndex);
    if (primeAfter < primeBefore) {
      reasons.push('ухудшена прима');
    }
    
    // Для ДЛИННЫХ нард: специфичные проверки
    if (isLong) {
      // Проверяем ухудшение распределения
      const distributionBefore = this.evaluateDistribution(stateBefore, playerIndex, mode);
      const distributionAfter = this.evaluateDistribution(stateAfter, playerIndex, mode);
      if (distributionAfter < distributionBefore - 0.2) {
        reasons.push('ухудшено распределение шашек');
      }
      
      // Проверяем ухудшение timing
      const timingBefore = this.evaluateTiming(stateBefore, playerIndex, mode);
      const timingAfter = this.evaluateTiming(stateAfter, playerIndex, mode);
      if (timingAfter < timingBefore - 0.2) {
        reasons.push('ухудшен timing позиции');
      }
      
      // Проверяем потерю якорей
      const anchorsBefore = this.countAnchors(pointsBefore, playerIndex, mode);
      const anchorsAfter = this.countAnchors(pointsAfter, playerIndex, mode);
      if (anchorsAfter < anchorsBefore) {
        reasons.push(`потеряно ${anchorsBefore - anchorsAfter} якорей`);
      }
      
      // Проверяем неэффективное использование кубиков
      const diceEfficiency = this.evaluateDiceEfficiency(currentMove, stateBefore, stateAfter, playerIndex);
      if (diceEfficiency < -0.1) {
        reasons.push('неэффективное использование кубиков');
      }
    }

    return reasons.length > 0 ? reasons.join(', ') : '';
  }

  /**
   * Генерация рекомендаций на основе ошибок
   */
  private generateRecommendations(errors: MoveAnalysis[], mode: string): string[] {
    const recommendations: string[] = [];

    const blunderCount = errors.filter((e) => e.errorType === 'blunder').length;
    const mistakeCount = errors.filter((e) => e.errorType === 'mistake').length;

    if (blunderCount > 3) {
      recommendations.push('Вы часто делаете серьезные ошибки. Рекомендуем изучить базовые стратегии нардов.');
    }

    if (mistakeCount > 5) {
      recommendations.push('Много ошибок в оценке позиций. Обратите внимание на расстановку шашек.');
    }

    const barErrors = errors.filter((e) => {
      return e.move.moves?.some((m: any) => {
        // Проверяем, были ли шашки на баре
        const beforeBar = e.move.gameStateBefore?.bar;
        return beforeBar && (beforeBar.white > 0 || beforeBar.black > 0);
      });
    });

    if (barErrors.length > 0) {
      recommendations.push('Проблемы с выведением шашек с бара. Изучите правила выброса.');
    }

    const bearOffErrors = errors.filter((e) => {
      return e.move.moves?.some((m: any) => {
        // Проверяем, были ли шашки в процессе вывода
        const after = e.move.gameStateAfter;
        const bearOff = after?.bearOff;
        return bearOff && (bearOff.white > 0 || bearOff.black > 0);
      });
    });

    if (bearOffErrors.length > 0 && bearOffErrors.length < errors.length / 2) {
      recommendations.push('Работа над техникой вывода шашек улучшит вашу игру.');
    }

    if (errors.length === 0) {
      recommendations.push('Отличная игра! Вы играли почти без ошибок.');
    }

    return recommendations;
  }

  /**
   * Расчет вероятностей выигрыша на основе equity и позиционных факторов
   * Использует расширенную формулу с учетом множества факторов
   */
  private calculateWinProbabilities(equity: number, gameState?: any, playerIndex?: number, mode?: string): WinProbabilities {
    // Equity в диапазоне примерно -2 до +2
    // Конвертируем в вероятность выигрыша
    
    // Используем улучшенную логистическую функцию
    // P(win) = 1 / (1 + exp(-k * equity))
    // где k - коэффициент, зависящий от типа позиции
    let k = 3.5; // Базовый коэффициент
    
    // Корректируем коэффициент в зависимости от типа позиции
    if (gameState && playerIndex !== undefined && mode) {
      const positionType = this.determinePositionType(gameState, playerIndex, mode);
      if (positionType === 'race') {
        k = 4.0; // В гонке equity более точно отражает вероятность
      } else if (positionType === 'back_game') {
        k = 3.0; // В back game equity менее точно отражает вероятность
      } else if (positionType === 'prime_game') {
        k = 3.8; // В prime game equity довольно точно
      }
    }
    
    const winProb = 1 / (1 + Math.exp(-k * equity));
    
    // Корректируем для крайних случаев
    let win = Math.min(0.999, Math.max(0.001, winProb));
    
    // Улучшенный расчет вероятностей гаммонов и бэкгамонов
    // Используем более точные формулы на основе equity и позиционных факторов
    let winG = 0;
    let winBG = 0;
    
    // Вероятность гаммона зависит от equity и типа позиции
    if (equity > 0.25) {
      // Базовая вероятность гаммона
      winG = Math.min(0.35, (equity - 0.25) * 0.6);
      
      // Корректируем в зависимости от типа позиции
      if (gameState && playerIndex !== undefined && mode) {
        const gammonPotential = this.evaluateGammonPotential(gameState, playerIndex, mode);
        winG += gammonPotential * 0.3; // Увеличиваем вероятность гаммона при хорошем потенциале
      }
    }
    
    // Вероятность бэкгаммона
    if (equity > 0.7) {
      winBG = Math.min(0.15, (equity - 0.7) * 0.4);
      
      // Бэкгаммон более вероятен при большом преимуществе и отсутствии шашек у противника
      if (gameState && playerIndex !== undefined) {
        const borneOff = Array.isArray(gameState.borneOff) 
          ? gameState.borneOff 
          : [gameState.borneOff?.white || 0, gameState.borneOff?.black || 0];
        const opponentBorneOff = borneOff[1 - playerIndex];
        if (opponentBorneOff === 0) {
          winBG += 0.1; // Дополнительный бонус если противник ничего не вывел
        }
      }
    }
    
    // Вероятности проигрыша с гаммоном/бэкгаммоном
    let loseG = 0;
    let loseBG = 0;
    
    if (equity < -0.25) {
      loseG = Math.min(0.35, Math.abs(equity + 0.25) * 0.6);
    }
    
    if (equity < -0.7) {
      loseBG = Math.min(0.15, Math.abs(equity + 0.7) * 0.4);
      
      // Бэкгаммон проигрыш более вероятен если мы ничего не вывели
      if (gameState && playerIndex !== undefined) {
        const borneOff = Array.isArray(gameState.borneOff) 
          ? gameState.borneOff 
          : [gameState.borneOff?.white || 0, gameState.borneOff?.black || 0];
        const myBorneOff = borneOff[playerIndex];
        if (myBorneOff === 0) {
          loseBG += 0.1;
        }
      }
    }
    
    // Нормализуем: обычная победа = общая победа минус гаммоны
    win = Math.max(0, win - winG - winBG);
    
    // Убеждаемся что сумма вероятностей не превышает 1
    const totalWin = win + winG + winBG;
    if (totalWin > 1) {
      const scale = 1 / totalWin;
      win *= scale;
      winG *= scale;
      winBG *= scale;
    }
    
    return {
      win: Math.max(0, Math.min(1, win)),
      winG: Math.max(0, Math.min(1, winG)),
      winBG: Math.max(0, Math.min(1, winBG)),
      loseG: Math.max(0, Math.min(1, loseG)),
      loseBG: Math.max(0, Math.min(1, loseBG)),
    };
  }
}

