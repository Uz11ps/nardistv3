import { Injectable, Inject, forwardRef, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';

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
  bestMove?: Array<{ from: number; to: number; die: number }>;
  scoreChange: number;
  equity?: number;
  winProbabilities?: WinProbabilities;
  alternatives?: Array<{
    moves: Array<{ from: number; to: number; die: number }>;
    equity: number;
    isCurrent?: boolean;
    diff?: number;
  }>;
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

    const engine = game.mode === 'short' ? this.backgammonEngine : this.longBackgammonEngine;
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

      // Находим все возможные ходы для этой позиции, чтобы показать альтернативы
      const allPossibleMovesSequences = engine.getAllValidMoves(gameStateBefore, move.dice);
      const evaluatedAlternatives: Array<{
        moves: Array<{ from: number; to: number; die: number }>;
        equity: number;
        isCurrent?: boolean;
        diff?: number;
      }> = allPossibleMovesSequences.map(mSeq => {
        let testState = { ...gameStateBefore };
        for (const m of mSeq) {
          testState = engine.applyMove(testState, m.from, m.to, m.die);
        }
        const score = this.evaluatePosition(engine, testState, userId === game.player1Id ? 0 : 1);
        return {
          moves: mSeq,
          equity: score / 100,
        };
      }).sort((a, b) => b.equity - a.equity).slice(0, 6);

      // Оцениваем позицию до и после хода
      const scoreBefore = this.evaluatePosition(engine, gameStateBefore, userId === game.player1Id ? 0 : 1);
      const scoreAfter = this.evaluatePosition(engine, gameStateAfter, userId === game.player1Id ? 0 : 1);
      
      const equity = scoreAfter / 100;
      const bestAlternative = evaluatedAlternatives[0];
      const bestScore = bestAlternative ? bestAlternative.equity * 100 : scoreBefore;
      
      // Добавляем текущий ход в альтернативы если его там нет (для сравнения)
      const currentMoveInAlts = evaluatedAlternatives.find(alt => 
        JSON.stringify(alt.moves) === JSON.stringify(move.moves)
      );
      
      if (!currentMoveInAlts) {
        evaluatedAlternatives.push({
          moves: move.moves as any,
          equity: equity,
          isCurrent: true
        });
        evaluatedAlternatives.sort((a, b) => b.equity - a.equity);
      } else {
        currentMoveInAlts.isCurrent = true;
      }

      // Расчитываем разницу (diff) для каждой альтернативы относительно лучшей
      const maxEquity = evaluatedAlternatives[0]?.equity || 0;
      evaluatedAlternatives.forEach(alt => {
        alt.diff = alt.equity - maxEquity;
      });

      const missedOpportunity = bestScore - scoreAfter;

      // Рассчитываем вероятности на основе equity (упрощенно)
      // Equity обычно от -1 до +1 (или больше при гаммонах)
      const winProb = Math.min(0.999, Math.max(0.001, 0.5 + (equity / 2)));
      const winProbabilities: WinProbabilities = {
        win: winProb,
        winG: Math.max(0, winProb * 0.2), // Примерная вероятность гаммона
        winBG: Math.max(0, winProb * 0.01), // Примерная вероятность бэкгаммона
        loseG: Math.max(0, (1 - winProb) * 0.15),
        loseBG: Math.max(0, (1 - winProb) * 0.005),
      };

      // Определяем тип ошибки
      let isError = false;
      let errorType: 'blunder' | 'mistake' | 'inaccuracy' | undefined;
      let errorDescription: string | undefined;

      if (missedOpportunity > 50) {
        isError = true;
        errorType = 'blunder';
        errorDescription = 'Грубая ошибка';
      } else if (missedOpportunity > 20) {
        isError = true;
        errorType = 'mistake';
        errorDescription = 'Ошибка';
      } else if (missedOpportunity > 5) {
        isError = true;
        errorType = 'inaccuracy';
        errorDescription = 'Неточность';
      }

      const analysis: MoveAnalysis = {
        moveNumber: move.moveNumber,
        move,
        isError,
        errorType,
        errorDescription,
        bestMove: bestAlternative?.moves,
        scoreChange: -missedOpportunity,
        equity,
        winProbabilities,
        alternatives: evaluatedAlternatives,
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

