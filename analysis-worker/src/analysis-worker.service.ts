import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GnubgService } from './gnubg.service';
import { MCTSLongBackgammonService } from './mcts-long-backgammon.service';
import { LongBackgammonEngine } from './long-backgammon-engine';
import { BackgammonEngine } from './backgammon-engine';
import { Game, GameMode } from './entities/game.entity';
import { GameMove } from './entities/game-move.entity';
import * as crypto from 'crypto';

interface AnalysisJob {
  id: string;
  gameId: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

@Injectable()
export class AnalysisWorkerService {
  private readonly logger = new Logger(AnalysisWorkerService.name);
  private jobs: Map<string, AnalysisJob> = new Map();

  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameMove)
    private movesRepository: Repository<GameMove>,
    private gnubgService?: GnubgService,
    private mctsLongBackgammonService?: MCTSLongBackgammonService,
    private longBackgammonEngine?: LongBackgammonEngine,
    private backgammonEngine?: BackgammonEngine,
  ) {}

  async startAnalysis(gameId: string, userId: string): Promise<string> {
    const jobId = crypto.randomUUID();
    
    const job: AnalysisJob = {
      id: jobId,
      gameId,
      userId,
      status: 'pending',
      progress: 0,
      startedAt: new Date(),
    };

    this.jobs.set(jobId, job);

    // Запускаем анализ асинхронно
    this.processAnalysis(job).catch(error => {
      this.logger.error(`Ошибка анализа ${jobId}:`, error);
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
    });

    return jobId;
  }

  async getAnalysisStatus(jobId: string): Promise<any> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException('Задача анализа не найдена');
    }

    return {
      status: job.status,
      progress: job.progress,
      result: job.status === 'completed' ? job.result : undefined,
      error: job.error,
    };
  }

  async getAnalysisResult(jobId: string): Promise<any> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException('Задача анализа не найдена');
    }

    if (job.status !== 'completed') {
      throw new Error(`Анализ еще не завершен. Статус: ${job.status}`);
    }

    return job.result;
  }

  private async processAnalysis(job: AnalysisJob): Promise<void> {
    job.status = 'processing';
    job.progress = 10;

    try {
      // Загружаем данные игры
      const game = await this.gamesRepository.findOne({
        where: { id: job.gameId },
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
      const isShortMode = game.mode === GameMode.SHORT;
      const allMovesAnalysis: any[] = [];
      const errors: any[] = [];
      let mistakes = 0;
      let blunders = 0;
      let inaccuracies = 0;

      this.logger.debug(`Анализ игры ${job.gameId}: режим ${isLongMode ? 'LONG' : 'SHORT'}`);

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

        // Обновляем прогресс
        processedMoves++;
        job.progress = 10 + Math.floor((processedMoves / totalMoves) * 80);

        // Добавляем небольшую задержку между анализами ходов
        if (processedMoves > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Анализируем ход с повторными попытками
        let moveAnalysis: any | null = null;
        const MAX_RETRIES = 3;
        let retryCount = 0;

        while (retryCount < MAX_RETRIES && !moveAnalysis) {
          try {
            if (isLongMode && this.mctsLongBackgammonService) {
              moveAnalysis = await this.analyzeMoveWithMCTS(move, moves, i, job.userId);
            } else if (!isLongMode && this.gnubgService?.isGnubgAvailable()) {
              moveAnalysis = await this.analyzeMoveWithGnubg(move, moves, i, job.userId);
            }
            
            if (!moveAnalysis && retryCount < MAX_RETRIES - 1) {
              retryCount++;
              this.logger.warn(`Анализ хода ${move.moveNumber} вернул null, попытка ${retryCount}/${MAX_RETRIES}`);
              await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
              continue;
            }
          } catch (error: any) {
            retryCount++;
            this.logger.warn(`Ошибка анализа хода ${move.moveNumber} (попытка ${retryCount}/${MAX_RETRIES}): ${error.message}`);
            
            if (retryCount < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
              continue;
            }
          }
          
          break;
        }

        if (moveAnalysis) {
          moveAnalysis.moveNumber = move.moveNumber;
          moveAnalysis.move = move;
          
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
          // Fallback анализ
          let fallbackEquity: number | undefined = undefined;
          try {
            if (isLongMode && this.mctsLongBackgammonService && move.gameStateAfter) {
              const stateAfter = this.convertToLongBoardState(move.gameStateAfter);
              const quickAnalysis = await this.mctsLongBackgammonService.analyzePosition(stateAfter, move.dice, 1000);
              fallbackEquity = quickAnalysis?.equity;
            } else if (!isLongMode && this.gnubgService && move.gameStateAfter) {
              const positionAfter = this.gnubgService.convertGameStateToGnubgPosition(move.gameStateAfter);
              const quickAnalysis = await this.gnubgService.analyzePosition(positionAfter);
              fallbackEquity = quickAnalysis?.equity;
            }
          } catch (e) {
            // Игнорируем ошибки fallback анализа
          }

          allMovesAnalysis.push({
            moveNumber: move.moveNumber,
            move,
            isError: false,
            scoreChange: 0,
            equity: fallbackEquity,
            equityBefore: undefined,
            equityAfter: fallbackEquity,
          });
        }
      }

      job.progress = 95;

      // Генерируем рекомендации
      const recommendations = this.generateRecommendations(errors, game.mode);

      job.progress = 100;
      job.status = 'completed';
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

      this.logger.log(`Анализ завершен: ${job.id}`);
    } catch (error: any) {
      this.logger.error(`Ошибка анализа игры ${job.gameId}:`, error);
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
    }
  }

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

      const madeMoveNormalized = JSON.stringify(madeMove.map(m => ({ from: m.from, to: m.to })).sort());
      const bestMoveNormalized = analysis.bestMove 
        ? JSON.stringify(analysis.bestMove.map((m: any) => ({ from: m.from, to: m.to })).sort())
        : null;
      
      const isBestMove = bestMoveNormalized && madeMoveNormalized === bestMoveNormalized;

      return {
        moveNumber: move.moveNumber,
        move,
        isError: false,
        scoreChange: analysis.scoreChange,
        equity: analysis.equityAfter,
        equityBefore: analysis.equityBefore,
        equityAfter: analysis.equityAfter,
        winProbabilities: analysis.winProbabilitiesAfter || {
          win: analysis.equityAfter,
          winG: 0,
          winBG: 0,
          loseG: 0,
          loseBG: 0,
        },
        bestMove: analysis.bestMove,
        alternatives: analysis.alternatives || [],
        isBestMove: isBestMove || analysis.moveQuality === 'excellent',
      };
    } catch (error: any) {
      this.logger.warn(`Ошибка MCTS анализа хода ${move.moveNumber}:`, error.message);
      return null;
    }
  }

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
      movesFromHead: gameState.movesFromHead || 0,
      movesFromPoint: gameState.movesFromPoint || {},
    };
  }

  private generateRecommendations(errors: any[], gameMode: GameMode): string[] {
    const recommendations: string[] = [];
    
    if (errors.length === 0) {
      recommendations.push('Отличная игра! Вы не допустили ошибок.');
      return recommendations;
    }

    const blunders = errors.filter(e => e.errorType === 'blunder').length;
    const mistakes = errors.filter(e => e.errorType === 'mistake').length;
    const inaccuracies = errors.filter(e => e.errorType === 'inaccuracy').length;

    if (blunders > 0) {
      recommendations.push(`Избегайте грубых ошибок (${blunders}). Они сильно ухудшают вашу позицию.`);
    }

    if (mistakes > 0) {
      recommendations.push(`Снизьте количество ошибок (${mistakes}). Анализируйте позицию перед каждым ходом.`);
    }

    if (inaccuracies > 0) {
      recommendations.push(`Улучшите точность ходов (${inaccuracies} неточностей).`);
    }

    return recommendations;
  }
}
