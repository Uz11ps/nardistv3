import { Injectable, Inject, forwardRef, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';

interface MoveAnalysis {
  moveNumber: number;
  move: GameMove;
  isError: boolean;
  errorType?: 'blunder' | 'mistake' | 'inaccuracy';
  errorDescription?: string;
  bestMove?: Array<{ from: number; to: number; die: number }>;
  scoreChange?: number; // Изменение оценочной позиции
}

interface GameAnalysis {
  gameId: string;
  totalMoves: number;
  errors: MoveAnalysis[];
  mistakes: number;
  blunders: number;
  inaccuracies: number;
  recommendations: string[];
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

    // Проверяем премиум подписку
    const hasPremium = await this.subscriptionService.hasActiveSubscription(userId);
    if (!hasPremium) {
      throw new ForbiddenException('Анализ игр доступен только для премиум пользователей');
    }

    // Загружаем все ходы
    const moves = await this.movesRepository.find({
      where: { gameId },
      order: { moveNumber: 'ASC' },
      relations: ['player'],
    });

    const engine = game.mode === 'short' ? this.backgammonEngine : this.longBackgammonEngine;
    const errors: MoveAnalysis[] = [];

    // Анализируем каждый ход
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isUserMove = move.playerId === userId;
      
      if (!isUserMove) continue; // Анализируем только ходы пользователя

      const gameStateBefore = move.gameStateBefore;
      const gameStateAfter = move.gameStateAfter;

      // Оцениваем позицию до и после хода
      const scoreBefore = this.evaluatePosition(engine, gameStateBefore, userId === game.player1Id ? 0 : 1);
      const scoreAfter = this.evaluatePosition(engine, gameStateAfter, userId === game.player1Id ? 0 : 1);

      // Находим лучший ход из возможных
      const bestMove = this.findBestMove(engine, gameStateBefore, move.dice);

      // Вычисляем оценку лучшего хода
      let bestScore = scoreBefore;
      if (bestMove) {
        // Симулируем лучший ход
        let testState = { ...gameStateBefore };
        for (const m of bestMove) {
          testState = engine.applyMove(testState, m.from, m.to, m.die);
        }
        bestScore = this.evaluatePosition(engine, testState, userId === game.player1Id ? 0 : 1);
      }

      const scoreChange = scoreAfter - scoreBefore;
      const missedOpportunity = bestScore - scoreAfter;

      // Определяем тип ошибки
      let isError = false;
      let errorType: 'blunder' | 'mistake' | 'inaccuracy' | undefined;
      let errorDescription: string | undefined;

      if (missedOpportunity > 50) {
        isError = true;
        errorType = 'blunder';
        errorDescription = 'Серьезная ошибка - упущена большая возможность';
      } else if (missedOpportunity > 20) {
        isError = true;
        errorType = 'mistake';
        errorDescription = 'Ошибка - был доступен более сильный ход';
      } else if (missedOpportunity > 5) {
        isError = true;
        errorType = 'inaccuracy';
        errorDescription = 'Неточность - ход не оптимален';
      }

      if (isError) {
        errors.push({
          moveNumber: move.moveNumber,
          move,
          isError: true,
          errorType,
          errorDescription,
          bestMove,
          scoreChange: missedOpportunity,
        });
      }
    }

    // Генерируем рекомендации
    const recommendations = this.generateRecommendations(errors, game.mode);

    return {
      gameId,
      totalMoves: moves.length,
      errors,
      mistakes: errors.filter((e) => e.errorType === 'mistake').length,
      blunders: errors.filter((e) => e.errorType === 'blunder').length,
      inaccuracies: errors.filter((e) => e.errorType === 'inaccuracy').length,
      recommendations,
    };
  }

  /**
   * Оценка позиции (простая эвристика)
   * gameState.points - массив чисел: положительные = белые (player 0), отрицательные = черные (player 1)
   */
  private evaluatePosition(engine: any, gameState: any, playerIndex: number): number {
    const points = gameState.points || [];
    const bar = gameState.bar || [0, 0]; // [белые, черные]
    const borneOff = gameState.borneOff || [0, 0]; // [белые, черные]

    let score = 0;

    // Шашки на баре - это плохо (минус)
    score -= bar[playerIndex] * 10;

    // Уведенные шашки - это хорошо (плюс)
    score += borneOff[playerIndex] * 5;

    // Оценка позиций на доске
    const homeBoardStart = playerIndex === 0 ? 18 : 0;
    const homeBoardEnd = playerIndex === 0 ? 23 : 5;

    for (let i = 0; i < points.length && i < 24; i++) {
      const pointValue = points[i] || 0;
      
      if (playerIndex === 0) {
        // Белые игроки
        if (pointValue > 0) {
          const checkerCount = pointValue;
          // Шашки в домашней доске - хорошо
          if (i >= homeBoardStart && i <= homeBoardEnd) {
            score += checkerCount * (6 - Math.abs(i - (homeBoardStart + homeBoardEnd) / 2));
          } else {
            // Расстояние до дома
            const distanceToHome = Math.max(0, 23 - i);
            score += checkerCount * distanceToHome;
          }
        }
      } else {
        // Черные игроки
        if (pointValue < 0) {
          const checkerCount = Math.abs(pointValue);
          // Шашки в домашней доске - хорошо
          if (i >= homeBoardStart && i <= homeBoardEnd) {
            score += checkerCount * (6 - Math.abs(i - (homeBoardStart + homeBoardEnd) / 2));
          } else {
            // Расстояние до дома
            const distanceToHome = Math.max(0, i - 0);
            score += checkerCount * distanceToHome;
          }
        }
      }
    }

    return score;
  }

  /**
   * Поиск лучшего хода (упрощенный алгоритм)
   */
  private findBestMove(engine: any, gameState: any, dice: number[]): Array<{ from: number; to: number; die: number }> | null {
    // Упрощенный алгоритм: пробуем все возможные ходы и выбираем лучший
    // В реальности нужен более сложный алгоритм (мини-макс, альфа-бета и т.д.)

    const allMoves = this.generateAllPossibleMoves(engine, gameState, dice);
    if (allMoves.length === 0) return null;

    let bestMove: Array<{ from: number; to: number; die: number }> | null = null;
    let bestScore = -Infinity;

    for (const moves of allMoves) {
      let testState = { ...gameState };
      try {
        for (const move of moves) {
          if (!engine.validateMove(testState, move.from, move.to, move.die)) {
            throw new Error('Invalid move');
          }
          testState = engine.applyMove(testState, move.from, move.to, move.die);
        }

        const score = this.evaluatePosition(engine, testState, gameState.currentPlayer);
        if (score > bestScore) {
          bestScore = score;
          bestMove = moves;
        }
      } catch (e) {
        // Пропускаем невалидные ходы
        continue;
      }
    }

    return bestMove;
  }

  /**
   * Генерация всех возможных ходов (упрощенная версия)
   */
  private generateAllPossibleMoves(engine: any, gameState: any, dice: number[]): Array<Array<{ from: number; to: number; die: number }>> {
    // Упрощенная генерация - в реальности нужно генерировать все валидные комбинации
    const moves: Array<Array<{ from: number; to: number; die: number }>> = [];
    
    const points = gameState.points || [];
    const currentPlayer = gameState.currentPlayer;
    const bar = gameState.bar || [0, 0];

    // Если есть шашки на баре, сначала нужно их выводить
    if (bar[currentPlayer] > 0) {
      for (const die of dice) {
        const enterPoint = currentPlayer === 0 ? (24 - die) : (die - 1);
        if (enterPoint >= 0 && enterPoint < 24) {
          const pointValue = points[enterPoint] || 0;
          // Можно войти, если точка пустая или содержит только свои шашки, или содержит только 1 чужую
          if (currentPlayer === 0) {
            if (pointValue >= 0 || pointValue === -1) {
              moves.push([{ from: -1, to: enterPoint, die }]); // -1 означает бар
            }
          } else {
            if (pointValue <= 0 || pointValue === 1) {
              moves.push([{ from: -1, to: enterPoint, die }]);
            }
          }
        }
      }
      return moves; // Если есть шашки на баре, сначала только их
    }

    // Генерируем ходы с доски
    for (let from = 0; from < points.length && from < 24; from++) {
      const pointValue = points[from] || 0;
      
      let hasPlayerChecker = false;
      if (currentPlayer === 0 && pointValue > 0) {
        hasPlayerChecker = true;
      } else if (currentPlayer === 1 && pointValue < 0) {
        hasPlayerChecker = true;
      }

      if (!hasPlayerChecker) continue;

      for (const die of dice) {
        const to = currentPlayer === 0 ? from + die : from - die;
        if (to >= 0 && to < 24) {
          // Проверяем валидность через engine
          try {
            if (engine.validateMove(gameState, from, to, die)) {
              moves.push([{ from, to, die }]);
            }
          } catch (e) {
            // Пропускаем невалидные ходы
          }
        } else if (to >= 24 || to < 0) {
          // Вывод шашек (bear off)
          if (currentPlayer === 0 && from >= 18) {
            moves.push([{ from, to: 24, die }]);
          } else if (currentPlayer === 1 && from <= 5) {
            moves.push([{ from, to: -1, die }]);
          }
        }
      }
    }

    return moves.slice(0, 20); // Ограничиваем для производительности
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
}

