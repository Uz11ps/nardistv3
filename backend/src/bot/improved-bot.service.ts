import { Injectable, Logger } from '@nestjs/common';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';
import { GameMode } from '../games/game.entity';

/**
 * Улучшенный бот с эвристиками безопасных/агрессивных ходов
 * Уровень: средний
 */
@Injectable()
export class ImprovedBotService {
  private readonly logger = new Logger(ImprovedBotService.name);

  constructor(
    private backgammonEngine: BackgammonEngine,
    private longBackgammonEngine: LongBackgammonEngine,
  ) {}

  /**
   * Выбрать лучший ход с использованием эвристик
   */
  selectBestMove(
    currentState: any,
    validMoves: Array<Array<{ from: number; to: number; die: number }>>,
    mode: GameMode,
  ): Array<{ from: number; to: number; die: number }> {
    if (validMoves.length === 0) {
      return [];
    }

    // ВАЖНО: Нормализуем bar в состоянии перед оценкой
    const normalizedState = { ...currentState };
    if (normalizedState.bar && !Array.isArray(normalizedState.bar)) {
      normalizedState.bar = [
        normalizedState.bar.white || normalizedState.bar[0] || 0,
        normalizedState.bar.black || normalizedState.bar[1] || 0
      ];
    }

    if (validMoves.length === 1) {
      return validMoves[0];
    }

    const engine = mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    
    // ВАЖНО: Приоритет ходам с бара, если есть шашки на баре
    const player = normalizedState.currentPlayer || 0;
    const barValue = Array.isArray(normalizedState.bar) 
      ? normalizedState.bar[player] 
      : (normalizedState.bar?.[player === 0 ? 'white' : 'black'] || 0);
    
    // Если есть шашки на баре, фильтруем только ходы с бара
    let movesToEvaluate = validMoves;
    if (barValue > 0 && mode === GameMode.SHORT) {
      const barMoves = validMoves.filter(seq => seq.some(m => m.from === -1));
      if (barMoves.length > 0) {
        movesToEvaluate = barMoves;
      }
    }
    
    let bestMove = movesToEvaluate[0];
    let bestScore = this.evaluateMoveSequence(normalizedState, movesToEvaluate[0], mode, engine);

    for (const move of movesToEvaluate.slice(1)) {
      const score = this.evaluateMoveSequence(normalizedState, move, mode, engine);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  /**
   * Оценка последовательности ходов
   */
  private evaluateMoveSequence(
    state: any,
    moves: Array<{ from: number; to: number; die: number }>,
    mode: GameMode,
    engine: any,
  ): number {
    let score = 0;
    let testState = JSON.parse(JSON.stringify(state));
    
    // ВАЖНО: Нормализуем bar в тестовом состоянии
    if (testState.bar && !Array.isArray(testState.bar)) {
      testState.bar = [
        testState.bar.white || testState.bar[0] || 0,
        testState.bar.black || testState.bar[1] || 0
      ];
    }

    for (const move of moves) {
      const moveScore = this.evaluateMove(testState, move, mode, engine);
      score += moveScore;
      
      // Применяем ход для оценки следующего
      testState = engine.applyMove(testState, move.from, move.to, move.die);
      
      // ВАЖНО: Нормализуем bar после каждого хода
      if (testState.bar && !Array.isArray(testState.bar)) {
        testState.bar = [
          testState.bar.white || testState.bar[0] || 0,
          testState.bar.black || testState.bar[1] || 0
        ];
      }
    }

    return score;
  }

  /**
   * Оценка одного хода с использованием эвристик
   */
  private evaluateMove(
    state: any,
    move: { from: number; to: number; die: number },
    mode: GameMode,
    engine: any,
  ): number {
    if (mode === GameMode.SHORT) {
      return this.evaluateShortBackgammonMove(state, move, engine);
    } else {
      return this.evaluateLongBackgammonMove(state, move, engine);
    }
  }

  /**
   * Эвристики для коротких нард
   */
  private evaluateShortBackgammonMove(
    state: any,
    move: { from: number; to: number; die: number },
    engine: any,
  ): number {
    let score = 0;
    const player = state.currentPlayer;
    const isPlayer1 = player === 0;
    const opponent = 1 - player;

    // ВАЖНО: Нормализуем bar для проверки
    let barValue = 0;
    if (Array.isArray(state.bar)) {
      barValue = state.bar[player] || 0;
    } else if (state.bar && typeof state.bar === 'object') {
      barValue = player === 0 
        ? (state.bar.white || state.bar[0] || 0)
        : (state.bar.black || state.bar[1] || 0);
    }

    // 1. Вход с бара - ОЧЕНЬ ВЫСОКИЙ приоритет (если есть шашки на баре)
    if (move.from === -1) {
      // Если есть шашки на баре, ход с бара ОБЯЗАТЕЛЕН - даем максимальный приоритет
      if (barValue > 0) {
        score += 1000; // Максимальный приоритет для ходов с бара
      } else {
        score += 50; // Обычный приоритет, если bar уже пуст (не должно происходить)
      }
      
      // Проверяем безопасность входа (не оставляем блот)
      const enterPoint = move.to;
      if (enterPoint >= 0 && enterPoint < 24) {
        const pointValue = state.points[enterPoint];
        if (isPlayer1 && pointValue === 1) {
          // Оставляем блот - небольшой штраф, но все равно приоритет выше чем обычные ходы
          score -= 20;
        } else if (!isPlayer1 && pointValue === -1) {
          score -= 20;
        }
      }
    } else if (barValue > 0) {
      // Если есть шашки на баре, но ход не с бара - большой штраф
      score -= 500;
    }

    // 2. Вынос шашек (bearing off) - очень высокий приоритет
    if (move.to < 0 || move.to >= 24) {
      score += 100;
      
      // Приоритет выносу ближайших к краю шашек
      if (isPlayer1) {
        const distance = 24 - move.from;
        score += (7 - distance) * 5; // Чем ближе к краю, тем лучше
      } else {
        const distance = move.from + 1;
        score += (7 - distance) * 5;
      }
    }

    // 3. Агрессивные ходы - сбивание шашки противника
    if (move.to >= 0 && move.to < 24) {
      const targetPoint = state.points[move.to];
      
      if (isPlayer1 && targetPoint === -1) {
        // Сбиваем шашку противника
        score += 40;
      } else if (!isPlayer1 && targetPoint === 1) {
        score += 40;
      }
    }

    // 4. Безопасные ходы - создание точек (points)
    if (move.to >= 0 && move.to < 24) {
      const targetPoint = state.points[move.to];
      
      if (isPlayer1) {
        // Создаем точку (2+ шашки)
        if (targetPoint === 0) {
          score += 15; // Пустая точка
        } else if (targetPoint === 1) {
          score += 25; // Делаем точку (2 шашки)
        } else if (targetPoint >= 2) {
          score += 10; // Укрепляем точку
        }
        
        // Блокируем противника (prime)
        if (targetPoint >= 2 && this.isInHome(0, move.to)) {
          score += 20;
        }
      } else {
        if (targetPoint === 0) {
          score += 15;
        } else if (targetPoint === -1) {
          score += 25;
        } else if (targetPoint <= -2) {
          score += 10;
        }
        
        if (targetPoint <= -2 && this.isInHome(1, move.to)) {
          score += 20;
        }
      }
    }

    // 5. Движение к дому
    if (move.to >= 0 && move.to < 24) {
      if (isPlayer1 && move.to >= 18) {
        score += 10; // В доме
      } else if (!isPlayer1 && move.to < 6) {
        score += 10;
      }
    }

    // 6. Избегаем оставлять блоты (одиночные шашки)
    if (move.from >= 0 && move.from < 24) {
      const fromPoint = state.points[move.from];
      if (isPlayer1 && fromPoint === 1) {
        // Убираем блот - хорошо
        score += 15;
      } else if (!isPlayer1 && fromPoint === -1) {
        score += 15;
      }
    }

    // 7. Стратегия: избегаем опасных зон
    if (move.to >= 0 && move.to < 24) {
      const danger = this.calculateDanger(state, move.to, isPlayer1);
      score -= danger * 5; // Штраф за опасность
    }

    return score;
  }

  /**
   * Эвристики для длинных нард
   */
  private evaluateLongBackgammonMove(
    state: any,
    move: { from: number; to: number; die: number },
    engine: any,
  ): number {
    let score = 0;
    const player = state.currentPlayer;
    const isPlayer1 = player === 0;
    const headIndex = isPlayer1 ? 0 : 12;

    // 1. Приоритет выноса шашек - ВЫСШИЙ (1000+)
    if (move.to === -1 || move.to < 0 || move.to >= 24) {
      score += 5000; // Огромный приоритет на вынос
    }

    // 2. Приоритет освобождения головы (особенно в начале игры)
    if (move.from === headIndex) {
      const checkersInHead = Math.abs(state.points[headIndex]);
      if (checkersInHead > 10) {
        score += 500; // В начале игры важно вывести шашки из головы
      } else if (checkersInHead > 5) {
        score += 200;
      } else if (checkersInHead > 1) {
        score += 50;
      }
    }

    // 3. Продвижение к дому
    // Для белых дом в пунктах 18-23. Для черных в пунктах 6-11.
    if (move.to >= 0 && move.to < 24) {
      const distFromHeadBefore = isPlayer1 
        ? move.from 
        : (move.from - headIndex + 24) % 24;
      const distFromHeadAfter = isPlayer1
        ? move.to
        : (move.to - headIndex + 24) % 24;
      
      score += (distFromHeadAfter - distFromHeadBefore) * 10;

      // Бонус за вход в дом - ТОЛЬКО если большинство шашек уже выведено из головы
      // Считаем шашки в голове
      const checkersInHead = Math.abs(state.points[headIndex] || 0);
      // Даем бонус только если в голове осталось меньше 8 шашек (больше половины выведено)
      if (checkersInHead < 8) {
        if (isPlayer1 && move.to >= 18) {
          score += 100;
        } else if (!isPlayer1 && move.to >= 6 && move.to < 12) {
          score += 100;
        }
      }
    }

    // 4. Построение блоков (занятие пустых пунктов)
    if (move.to >= 0 && move.to < 24 && state.points[move.to] === 0) {
      score += 50; // Бонус за занятие нового пункта
      
      // Дополнительный бонус за блокировку соперника (6 подряд)
      // (Упрощенно: бонус за соседство со своими шашками)
      for (let i = 1; i <= 6; i++) {
        const neighborIdx = (move.to - i + 24) % 24;
        const neighborValue = state.points[neighborIdx];
        if (isPlayer1 ? neighborValue > 0 : neighborValue < 0) {
          score += 20;
        } else {
          break;
        }
      }
    }

    // 5. Укрепление существующих пунктов
    if (move.to >= 0 && move.to < 24) {
      const targetPoint = state.points[move.to];
      if (isPlayer1 && targetPoint > 0) {
        score += 30;
      } else if (!isPlayer1 && targetPoint < 0) {
        score += 30;
      }
    }

    return score;
  }

  /**
   * Проверка, находится ли точка в доме игрока
   */
  private isInHome(player: number, pointIndex: number): boolean {
    if (player === 0) {
      // White home: points 1-6 (indices 18-23)
      return pointIndex >= 18 && pointIndex < 24;
    } else {
      // Black home: points 19-24 (indices 0-5)
      return pointIndex >= 0 && pointIndex < 6;
    }
  }

  /**
   * Расчет опасности точки (вероятность быть сбитым)
   */
  private calculateDanger(state: any, pointIndex: number, isPlayer1: boolean): number {
    let danger = 0;
    const opponentSign = isPlayer1 ? -1 : 1;
    
    // Проверяем, может ли противник сбить шашку с этой точки
    for (let die = 1; die <= 6; die++) {
      let attackPoint: number;
      
      if (isPlayer1) {
        // Противник (черные) движутся назад
        attackPoint = pointIndex - die;
        if (attackPoint < 0) attackPoint += 24;
      } else {
        // Противник (белые) движутся вперед
        attackPoint = pointIndex + die;
        if (attackPoint >= 24) attackPoint -= 24;
      }
      
      if (attackPoint >= 0 && attackPoint < 24) {
        const pointValue = state.points[attackPoint];
        // Если у противника есть шашка, которая может сбить
        if (pointValue * opponentSign > 0) {
          danger += 2;
        }
      }
    }
    
    return danger;
  }
}

