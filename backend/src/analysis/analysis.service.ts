import { Injectable, Inject, forwardRef, ForbiddenException, Optional, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameMode } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';
import { GptBotService } from '../bot/gpt-bot.service';
import { GnubgService } from './gnubg.service';
import { MCTSLongBackgammonService } from './mcts-long-backgammon.service';
import { AnalysisQueueService, AnalysisStatus } from './analysis-queue.service';

interface MoveAnalysis {
  moveNumber: number;
  move: GameMove;
  isError: boolean;
  errorType?: 'blunder' | 'mistake' | 'inaccuracy';
  errorDescription?: string;
  isBestMove?: boolean;
  bestMove?: Array<{ from: number; to: number; die: number }> | string;
  scoreChange: number;
  equity?: number;
  equityBefore?: number;
  equityAfter?: number;
  winProbabilities?: {
    win: number;
    winG: number;
    winBG: number;
    loseG: number;
    loseBG: number;
  };
  alternatives?: Array<{
    moves: Array<{ from: number; to: number; die: number }>;
    equity: number;
    diff: number;
  }>;
}

export interface GameAnalysis {
  gameId: string;
  totalMoves: number;
  allMoves: MoveAnalysis[];
  errors: MoveAnalysis[];
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
    @Optional() private gnubgService?: GnubgService,
    @Optional() private mctsLongBackgammonService?: MCTSLongBackgammonService,
    private analysisQueueService?: AnalysisQueueService,
  ) {}

  /**
   * Анализ игры - асинхронный через очередь
   * Возвращает jobId для отслеживания статуса
   */
  async analyzeGame(userId: string, gameId: string): Promise<{ jobId: string; status: string }> {
    // Проверяем доступ к игре
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['player1', 'player2'],
    });

    if (!game) {
      throw new NotFoundException('Игра не найдена');
    }

    if (game.player1Id !== userId && game.player2Id !== userId) {
      throw new ForbiddenException('Нет доступа к этой игре');
    }

    // Добавляем в очередь анализа
    if (this.analysisQueueService) {
      const jobId = await this.analysisQueueService.enqueueAnalysis(gameId, userId);
      return {
        jobId,
        status: 'pending',
      };
    }

    // Fallback: синхронный анализ (если очередь недоступна)
    // В этом случае выполняем синхронно и сразу возвращаем результат
    throw new Error('Analysis queue service недоступен. Используйте синхронный метод.');
  }

  /**
   * Получение статуса анализа
   */
  async getAnalysisStatus(jobId: string, userId: string): Promise<{
    status: string;
    progress?: number;
    result?: GameAnalysis;
    error?: string;
  }> {
    if (!this.analysisQueueService) {
      throw new Error('Analysis queue service недоступен');
    }

    const job = this.analysisQueueService.getJobStatus(jobId);
    
    if (!job) {
      throw new NotFoundException('Задача анализа не найдена');
    }

    // Проверяем доступ
    const game = await this.gamesRepository.findOne({
      where: { id: job.gameId },
    });

    if (!game || (game.player1Id !== userId && game.player2Id !== userId)) {
      throw new ForbiddenException('Нет доступа к этой задаче');
    }

    return {
      status: job.status,
      progress: job.progress,
      result: job.status === AnalysisStatus.COMPLETED ? job.result : undefined,
      error: job.error,
    };
  }

  /**
   * Получение результата анализа (если готов)
   */
  async getAnalysisResult(jobId: string, userId: string): Promise<GameAnalysis> {
    if (!this.analysisQueueService) {
      throw new Error('Analysis queue service недоступен');
    }

    const job = this.analysisQueueService.getJobStatus(jobId);
    
    if (!job) {
      throw new NotFoundException('Задача анализа не найдена');
    }

    // Проверяем доступ
    const game = await this.gamesRepository.findOne({
      where: { id: job.gameId },
    });

    if (!game || (game.player1Id !== userId && game.player2Id !== userId)) {
      throw new ForbiddenException('Нет доступа к этой задаче');
    }

    if (job.status !== AnalysisStatus.COMPLETED) {
      throw new Error(`Анализ еще не завершен. Статус: ${job.status}`);
    }

    if (!job.result) {
      throw new Error('Результат анализа недоступен');
    }

    return job.result;
  }

  /**
   * Получение статистики очереди
   */
  getQueueStats() {
    if (!this.analysisQueueService) {
      return null;
    }
    return this.analysisQueueService.getQueueStats();
  }

  /**
   * Синхронный анализ игры (fallback, если очередь недоступна)
   * @deprecated Используйте analyzeGame для асинхронной обработки
   */
  private async analyzeGameSync(userId: string, gameId: string): Promise<GameAnalysis> {
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

    const moves = await this.movesRepository.find({
      where: { gameId: game.id },
      order: { moveNumber: 'ASC' },
    });

    const allMovesAnalysis: MoveAnalysis[] = [];
    const errors: MoveAnalysis[] = [];
    let mistakes = 0;
    let blunders = 0;
    let inaccuracies = 0;

    const isLongMode = game.mode === GameMode.LONG;
    const isShortMode = game.mode === GameMode.SHORT;

    // Анализируем каждый ход пользователя
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isUserMove = move.playerId === userId;
      
      if (!isUserMove) {
        // Пропускаем ходы противника
        allMovesAnalysis.push({
          moveNumber: move.moveNumber,
          move,
          isError: false,
          scoreChange: 0,
        });
        continue;
      }

      // Определяем, является ли это первым ходом игры
      const isFirstMoveOfGame = isShortMode 
        ? move.moveNumber === 1 
        : move.moveNumber <= 2;
      
      // Пропускаем анализ первых ходов
      if (isFirstMoveOfGame) {
        allMovesAnalysis.push({
          moveNumber: move.moveNumber,
          move,
          isError: false,
          scoreChange: 0,
        });
        continue;
      }

      // Анализируем ход в зависимости от режима игры
      let moveAnalysis: MoveAnalysis | null = null;

      if (isLongMode && this.mctsLongBackgammonService) {
        // Длинные нарды - используем MCTS
        moveAnalysis = await this.analyzeMoveWithMCTS(move, moves, i, userId);
      } else if (isShortMode && this.gnubgService?.isGnubgAvailable()) {
        // Короткие нарды - используем GNU Backgammon
        moveAnalysis = await this.analyzeMoveWithGnubg(move, moves, i, userId);
      }

      if (moveAnalysis) {
        // Определяем ошибки на основе scoreChange
        if (moveAnalysis.scoreChange >= 0.10) {
          moveAnalysis.isError = true;
          moveAnalysis.errorType = 'blunder';
          moveAnalysis.errorDescription = `Грубая ошибка: потеряно ${moveAnalysis.scoreChange.toFixed(3)} equity`;
          blunders++;
        } else if (moveAnalysis.scoreChange >= 0.05) {
          moveAnalysis.isError = true;
          moveAnalysis.errorType = 'mistake';
          moveAnalysis.errorDescription = `Ошибка: потеряно ${moveAnalysis.scoreChange.toFixed(3)} equity`;
          mistakes++;
        } else if (moveAnalysis.scoreChange >= 0.02) {
          moveAnalysis.isError = true;
          moveAnalysis.errorType = 'inaccuracy';
          moveAnalysis.errorDescription = `Неточность: потеряно ${moveAnalysis.scoreChange.toFixed(3)} equity`;
          inaccuracies++;
        } else if (moveAnalysis.scoreChange <= -0.01) {
          moveAnalysis.isBestMove = true;
        }

        allMovesAnalysis.push(moveAnalysis);
        if (moveAnalysis.isError) {
          errors.push(moveAnalysis);
        }
      } else {
        // Если анализ недоступен, добавляем базовую запись
        allMovesAnalysis.push({
          moveNumber: move.moveNumber,
          move,
          isError: false,
          scoreChange: 0,
        });
      }
    }

    // Генерируем рекомендации
    const recommendations = this.generateRecommendations(errors, game.mode);

    return {
      gameId: game.id,
      totalMoves: moves.length,
      allMoves: allMovesAnalysis,
      errors,
      mistakes,
      blunders,
      inaccuracies,
      recommendations,
      gameResult: game.winnerId === userId ? 'win' : (game.winnerId === null ? undefined : 'loss'),
    };
  }

  /**
   * Анализ хода с использованием MCTS (длинные нарды)
   */
  private async analyzeMoveWithMCTS(
    move: GameMove,
    allMoves: GameMove[],
    moveIndex: number,
    userId: string,
  ): Promise<MoveAnalysis | null> {
    if (!this.mctsLongBackgammonService) return null;

    try {
      const stateBefore = this.convertToLongBoardState(move.gameStateBefore);
      const stateAfter = this.convertToLongBoardState(move.gameStateAfter);
      const dice = move.dice || [];
      const madeMove = move.moves || [];

      // Анализируем ход
      const analysis = await this.mctsLongBackgammonService.analyzeMove(
        stateBefore,
        stateAfter,
        dice,
        madeMove.map((m: any) => ({
          from: m.from,
          to: m.to,
          die: m.die || 0,
        })),
        undefined, // Использует значение по умолчанию из переменных окружения
      );

      if (!analysis) return null;

      return {
        moveNumber: move.moveNumber,
        move,
        isError: false,
        scoreChange: analysis.scoreChange,
        equity: analysis.equityAfter,
        equityBefore: analysis.equityBefore,
        equityAfter: analysis.equityAfter,
        winProbabilities: {
          win: analysis.equityAfter,
          winG: 0,
          winBG: 0,
          loseG: 0,
          loseBG: 0,
        },
        bestMove: analysis.bestMove,
        alternatives: analysis.alternatives,
        isBestMove: analysis.moveQuality === 'excellent',
      };
    } catch (error: any) {
      console.error(`Ошибка MCTS анализа хода ${move.moveNumber}:`, error);
      return null;
    }
  }

  /**
   * Анализ хода с использованием GNU Backgammon (короткие нарды)
   */
  private async analyzeMoveWithGnubg(
    move: GameMove,
    allMoves: GameMove[],
    moveIndex: number,
    userId: string,
  ): Promise<MoveAnalysis | null> {
    if (!this.gnubgService) return null;

    try {
      const positionBefore = this.gnubgService.convertGameStateToGnubgPosition(move.gameStateBefore);
      const positionAfter = this.gnubgService.convertGameStateToGnubgPosition(move.gameStateAfter);
      const dice = move.dice || [];
      const madeMove = move.moves || [];

      // Анализируем ход
      const analysis = await this.gnubgService.analyzeMove(
        positionBefore,
        positionAfter,
        dice,
        madeMove.map((m: any) => ({
          from: m.from,
          to: m.to,
        })),
      );

      if (!analysis) return null;

      // Анализируем позицию до хода для получения вероятностей
      const analysisBefore = await this.gnubgService.analyzePosition(positionBefore, dice);
      const winProbabilities = analysisBefore?.winProbabilities || {
        win: analysis.equityBefore,
        winG: 0,
        winBG: 0,
        loseG: 0,
        loseBG: 0,
      };

      // Конвертируем bestMove и alternatives в нужный формат
      // GNU Backgammon возвращает ходы без die, нужно добавить из исходного хода
      const bestMoveFormatted = analysis.bestMove 
        ? analysis.bestMove.map((m, idx) => {
            const originalMove = madeMove[idx];
            return {
              from: m.from,
              to: m.to,
              die: originalMove?.die || Math.abs(m.to - m.from) || 0,
            };
          })
        : undefined;
      
      const alternativesFormatted = analysis.alternatives
        ? analysis.alternatives.map(alt => ({
            moves: alt.moves.map((m, idx) => {
              const originalMove = madeMove[idx];
              return {
                from: m.from,
                to: m.to,
                die: originalMove?.die || Math.abs(m.to - m.from) || 0,
              };
            }),
            equity: alt.equity,
            diff: alt.diff,
          }))
        : undefined;

      return {
        moveNumber: move.moveNumber,
        move,
        isError: false,
        scoreChange: analysis.scoreChange,
        equity: analysis.equityAfter,
        equityBefore: analysis.equityBefore,
        equityAfter: analysis.equityAfter,
        winProbabilities,
        bestMove: bestMoveFormatted,
        alternatives: alternativesFormatted,
        isBestMove: analysis.moveQuality === 'excellent',
      };
    } catch (error: any) {
      console.error(`Ошибка GNU Backgammon анализа хода ${move.moveNumber}:`, error);
      return null;
    }
  }

  /**
   * Конвертация состояния игры в формат LongBoardState
   */
  private convertToLongBoardState(gameState: any): any {
    if (!gameState) {
      return this.longBackgammonEngine.createInitialState();
    }

    const points = gameState.points || new Array(24).fill(0);
    const bar = gameState.bar || [0, 0];
    const borneOff = gameState.borneOff || gameState.bearOff || [0, 0];
    const currentPlayer = gameState.currentPlayer || 0;
    const dice = gameState.dice || [];

    // Нормализуем bar и borneOff
    let normalizedBar: [number, number] = [0, 0];
    if (Array.isArray(bar)) {
      normalizedBar = [bar[0] || 0, bar[1] || 0];
    } else if (bar && typeof bar === 'object') {
      normalizedBar = [bar.white || bar[0] || 0, bar.black || bar[1] || 0];
    }

    let normalizedBorneOff: [number, number] = [0, 0];
    if (Array.isArray(borneOff)) {
      normalizedBorneOff = [borneOff[0] || 0, borneOff[1] || 0];
    } else if (borneOff && typeof borneOff === 'object') {
      normalizedBorneOff = [borneOff.white || borneOff[0] || 0, borneOff.black || borneOff[1] || 0];
    }

    return {
      points,
      bar: normalizedBar,
      borneOff: normalizedBorneOff,
      currentPlayer,
      dice,
      movesFromHead: 0,
      movesFromPoint: {},
    };
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
        const beforeBar = e.move.gameStateBefore?.bar;
        return beforeBar && (beforeBar.white > 0 || beforeBar.black > 0);
      });
    });

    if (barErrors.length > 0) {
      recommendations.push('Проблемы с выведением шашек с бара. Изучите правила выброса.');
    }

    if (errors.length === 0) {
      recommendations.push('Отличная игра! Вы играли почти без ошибок.');
    }

    return recommendations;
  }
}
