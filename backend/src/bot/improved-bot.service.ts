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

    if (validMoves.length === 1) {
      return validMoves[0];
    }

    const engine = mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    
    let bestMove = validMoves[0];
    let bestScore = this.evaluateMoveSequence(currentState, validMoves[0], mode, engine);

    for (const move of validMoves.slice(1)) {
      const score = this.evaluateMoveSequence(currentState, move, mode, engine);
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

    for (const move of moves) {
      const moveScore = this.evaluateMove(testState, move, mode, engine);
      score += moveScore;
      
      // Применяем ход для оценки следующего
      testState = engine.applyMove(testState, move.from, move.to, move.die);
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

    // 1. Вход с бара - высокий приоритет
    if (move.from === -1) {
      score += 50;
      
      // Проверяем безопасность входа (не оставляем блот)
      const enterPoint = move.to;
      if (enterPoint >= 0 && enterPoint < 24) {
        const pointValue = state.points[enterPoint];
        if (isPlayer1 && pointValue === 1) {
          // Оставляем блот - штраф
          score -= 30;
        } else if (!isPlayer1 && pointValue === -1) {
          score -= 30;
        }
      }
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

    // 1. Вынос шашек - высший приоритет
    if (move.to < 0 || move.to >= 24) {
      score += 100;
    }

    // 2. Движение к дому
    if (move.to >= 0 && move.to < 24) {
      if (isPlayer1 && move.to >= 18) {
        score += 15;
      } else if (!isPlayer1 && move.to >= 6 && move.to < 12) {
        score += 15;
      }
    }

    // 3. Создание блоков (защита)
    if (move.to >= 0 && move.to < 24) {
      const targetPoint = state.points[move.to];
      if (isPlayer1 && targetPoint >= 2) {
        score += 20; // Укрепляем блок
      } else if (!isPlayer1 && targetPoint <= -2) {
        score += 20;
      }
    }

    // 4. Избегаем оставлять шашки далеко от дома
    if (move.from >= 0 && move.from < 24) {
      if (isPlayer1) {
        const distance = (move.from - 0 + 24) % 24;
        if (distance > 12) {
          score += 10; // Убираем дальнюю шашку
        }
      } else {
        const distance = (move.from - 12 + 24) % 24;
        if (distance > 12) {
          score += 10;
        }
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

