import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameMove } from '../games/game-move.entity';
import { Game, GameMode } from '../games/game.entity';
import { GnubgService } from './gnubg.service';
import { MCTSLongBackgammonService } from './mcts-long-backgammon.service';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';

export enum AnalysisStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface AnalysisJob {
  id: string;
  gameId: string;
  userId: string;
  status: AnalysisStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number;
  result?: any;
  error?: string;
}

@Injectable()
export class AnalysisQueueService {
  private readonly logger = new Logger(AnalysisQueueService.name);
  private readonly MAX_CONCURRENT_ANALYSES: number;
  private readonly QUEUE_CHECK_INTERVAL = 1000; // Проверка очереди каждую секунду
  
  private activeJobs: Map<string, AnalysisJob> = new Map();
  private pendingQueue: AnalysisJob[] = [];
  private processingCount = 0;
  private queueInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameMove)
    private movesRepository: Repository<GameMove>,
    @Optional() private gnubgService?: GnubgService,
    @Optional() private mctsLongBackgammonService?: MCTSLongBackgammonService,
    @Optional() private longBackgammonEngine?: LongBackgammonEngine,
    @Optional() private backgammonEngine?: BackgammonEngine,
  ) {
    // Читаем настройки из переменных окружения
    this.MAX_CONCURRENT_ANALYSES = parseInt(
      process.env.MAX_CONCURRENT_ANALYSES || '3',
      10,
    );
    
    this.logger.log(`AnalysisQueueService инициализирован: MAX_CONCURRENT_ANALYSES=${this.MAX_CONCURRENT_ANALYSES}`);
    
    // Запускаем обработчик очереди
    this.startQueueProcessor();
  }

  /**
   * Добавление задачи анализа в очередь
   */
  async enqueueAnalysis(gameId: string, userId: string): Promise<string> {
    const jobId = `analysis_${gameId}_${userId}_${Date.now()}`;
    
    const job: AnalysisJob = {
      id: jobId,
      gameId,
      userId,
      status: AnalysisStatus.PENDING,
      createdAt: new Date(),
    };

    this.pendingQueue.push(job);
    this.activeJobs.set(jobId, job);
    
    this.logger.debug(`Анализ добавлен в очередь: ${jobId} (в очереди: ${this.pendingQueue.length})`);
    
    // Запускаем обработку если есть свободные слоты
    this.processQueue();
    
    return jobId;
  }

  /**
   * Получение статуса задачи анализа
   */
  getJobStatus(jobId: string): AnalysisJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Получение результата анализа (если готов)
   */
  getJobResult(jobId: string): any | null {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === AnalysisStatus.COMPLETED) {
      return job.result;
    }
    return null;
  }

  /**
   * Удаление завершенной задачи (очистка памяти)
   */
  removeJob(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (job && (job.status === AnalysisStatus.COMPLETED || job.status === AnalysisStatus.FAILED)) {
      this.activeJobs.delete(jobId);
      this.logger.debug(`Задача удалена из памяти: ${jobId}`);
    }
  }

  /**
   * Запуск обработчика очереди
   */
  private startQueueProcessor(): void {
    if (this.queueInterval) {
      return;
    }

    this.queueInterval = setInterval(() => {
      this.processQueue();
    }, this.QUEUE_CHECK_INTERVAL);

    this.logger.log('Обработчик очереди анализа запущен');
  }

  /**
   * Обработка очереди - запуск анализа если есть свободные слоты
   */
  private async processQueue(): Promise<void> {
    // Проверяем, есть ли свободные слоты
    const availableSlots = this.MAX_CONCURRENT_ANALYSES - this.processingCount;
    
    if (availableSlots <= 0 || this.pendingQueue.length === 0) {
      return;
    }

    // Берем задачи из очереди
    const jobsToProcess = this.pendingQueue.splice(0, availableSlots);
    
    // Запускаем обработку каждой задачи
    for (const job of jobsToProcess) {
      this.processJob(job).catch(error => {
        this.logger.error(`Ошибка обработки задачи ${job.id}:`, error);
        job.status = AnalysisStatus.FAILED;
        job.error = error.message;
        job.completedAt = new Date();
        this.processingCount--;
      });
    }
  }

  /**
   * Обработка одной задачи анализа
   */
  private async processJob(job: AnalysisJob): Promise<void> {
    this.processingCount++;
    job.status = AnalysisStatus.PROCESSING;
    job.startedAt = new Date();
    
    this.logger.log(`Начата обработка анализа: ${job.id} (активных: ${this.processingCount}/${this.MAX_CONCURRENT_ANALYSES})`);

    try {
      // Загружаем данные игры
      const game = await this.gamesRepository.findOne({
        where: { id: job.gameId },
        relations: ['player1', 'player2'],
      });

      if (!game) {
        throw new Error('Игра не найдена');
      }

      const moves = await this.movesRepository.find({
        where: { gameId: game.id },
        order: { moveNumber: 'ASC' },
      });

      job.progress = 10;

      // Анализируем игру в зависимости от режима
      const isLongMode = game.mode === GameMode.LONG;
      const allMovesAnalysis: any[] = [];
      const errors: any[] = [];
      let mistakes = 0;
      let blunders = 0;
      let inaccuracies = 0;

      const totalMoves = moves.filter(m => m.playerId === job.userId).length;
      let processedMoves = 0;

      // Анализируем каждый ход пользователя
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const isUserMove = move.playerId === job.userId;

        if (!isUserMove) {
          allMovesAnalysis.push({
            moveNumber: move.moveNumber,
            move,
            isError: false,
            scoreChange: 0,
          });
          continue;
        }

        // Определяем, является ли это первым ходом игры
        const isFirstMoveOfGame = game.mode === GameMode.SHORT
          ? move.moveNumber === 1
          : move.moveNumber <= 2;

        if (isFirstMoveOfGame) {
          allMovesAnalysis.push({
            moveNumber: move.moveNumber,
            move,
            isError: false,
            scoreChange: 0,
          });
          continue;
        }

        // Обновляем прогресс
        processedMoves++;
        job.progress = 10 + Math.floor((processedMoves / totalMoves) * 80);

        // Анализируем ход
        let moveAnalysis: any | null = null;

        if (isLongMode && this.mctsLongBackgammonService) {
          moveAnalysis = await this.analyzeMoveWithMCTS(move, moves, i, job.userId);
        } else if (!isLongMode && this.gnubgService?.isGnubgAvailable()) {
          moveAnalysis = await this.analyzeMoveWithGnubg(move, moves, i, job.userId);
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
          allMovesAnalysis.push({
            moveNumber: move.moveNumber,
            move,
            isError: false,
            scoreChange: 0,
          });
        }
      }

      job.progress = 95;

      // Генерируем рекомендации
      const recommendations = this.generateRecommendations(errors, game.mode);

      job.progress = 100;
      job.status = AnalysisStatus.COMPLETED;
      job.completedAt = new Date();
      job.result = {
        gameId: game.id,
        totalMoves: moves.length,
        allMoves: allMovesAnalysis,
        errors,
        mistakes,
        blunders,
        inaccuracies,
        recommendations,
        gameResult: game.winnerId === job.userId ? 'win' : (game.winnerId === null ? undefined : 'loss'),
      };

      this.logger.log(`Анализ завершен: ${job.id} (время: ${job.completedAt.getTime() - job.startedAt!.getTime()}ms)`);
    } catch (error: any) {
      this.logger.error(`Ошибка анализа игры ${job.gameId}:`, error);
      job.status = AnalysisStatus.FAILED;
      job.error = error.message;
      job.completedAt = new Date();
    } finally {
      this.processingCount--;
      // Запускаем обработку следующей задачи
      this.processQueue();
    }
  }

  /**
   * Анализ хода с использованием MCTS (длинные нарды)
   */
  private async analyzeMoveWithMCTS(
    move: GameMove,
    allMoves: GameMove[],
    moveIndex: number,
    userId: string,
  ): Promise<any | null> {
    if (!this.mctsLongBackgammonService || !this.longBackgammonEngine) return null;

    try {
      const stateBefore = this.convertToLongBoardState(move.gameStateBefore);
      const stateAfter = this.convertToLongBoardState(move.gameStateAfter);
      const dice = move.dice || [];
      const madeMove = move.moves || [];

      const analysis = await this.mctsLongBackgammonService.analyzeMove(
        stateBefore,
        stateAfter,
        dice,
        madeMove.map((m: any) => ({
          from: m.from,
          to: m.to,
          die: m.die || 0,
        })),
        undefined,
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
      this.logger.warn(`Ошибка MCTS анализа хода ${move.moveNumber}:`, error.message);
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
  ): Promise<any | null> {
    if (!this.gnubgService) return null;

    try {
      const positionBefore = this.gnubgService.convertGameStateToGnubgPosition(move.gameStateBefore);
      const positionAfter = this.gnubgService.convertGameStateToGnubgPosition(move.gameStateAfter);
      const dice = move.dice || [];
      const madeMove = move.moves || [];

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

      const analysisBefore = await this.gnubgService.analyzePosition(positionBefore, dice);
      const winProbabilities = analysisBefore?.winProbabilities || {
        win: analysis.equityBefore,
        winG: 0,
        winBG: 0,
        loseG: 0,
        loseBG: 0,
      };

      const bestMoveFormatted = analysis.bestMove
        ? analysis.bestMove.map((m: any, idx: number) => {
            const originalMove = madeMove[idx];
            return {
              from: m.from,
              to: m.to,
              die: originalMove?.die || Math.abs(m.to - m.from) || 0,
            };
          })
        : undefined;

      const alternativesFormatted = analysis.alternatives
        ? analysis.alternatives.map((alt: any) => ({
            moves: alt.moves.map((m: any, idx: number) => {
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
      this.logger.warn(`Ошибка GNU Backgammon анализа хода ${move.moveNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Конвертация состояния игры в формат LongBoardState
   */
  private convertToLongBoardState(gameState: any): any {
    if (!gameState || !this.longBackgammonEngine) {
      return this.longBackgammonEngine?.createInitialState() || {};
    }

    const points = gameState.points || new Array(24).fill(0);
    const bar = gameState.bar || [0, 0];
    const borneOff = gameState.borneOff || gameState.bearOff || [0, 0];
    const currentPlayer = gameState.currentPlayer || 0;
    const dice = gameState.dice || [];

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
  private generateRecommendations(errors: any[], mode: string): string[] {
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

  /**
   * Получение статистики очереди
   */
  getQueueStats(): {
    pending: number;
    processing: number;
    maxConcurrent: number;
    totalActive: number;
  } {
    return {
      pending: this.pendingQueue.length,
      processing: this.processingCount,
      maxConcurrent: this.MAX_CONCURRENT_ANALYSES,
      totalActive: this.activeJobs.size,
    };
  }

  /**
   * Очистка старых завершенных задач
   */
  cleanupOldJobs(maxAge: number = 3600000): void {
    const now = Date.now();
    const jobsToRemove: string[] = [];

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (
        (job.status === AnalysisStatus.COMPLETED || job.status === AnalysisStatus.FAILED) &&
        job.completedAt &&
        now - job.completedAt.getTime() > maxAge
      ) {
        jobsToRemove.push(jobId);
      }
    }

    for (const jobId of jobsToRemove) {
      this.activeJobs.delete(jobId);
    }

    if (jobsToRemove.length > 0) {
      this.logger.debug(`Очищено ${jobsToRemove.length} старых задач анализа`);
    }
  }
}

