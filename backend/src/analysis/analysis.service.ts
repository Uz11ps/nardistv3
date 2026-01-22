import { Injectable, Inject, forwardRef, ForbiddenException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameMode } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';
import { GptBotService } from '../bot/gpt-bot.service';

interface MoveAnalysis {
  moveNumber: number;
  move: GameMove;
  isError: boolean;
  errorType?: 'blunder' | 'mistake' | 'inaccuracy';
  errorDescription?: string;
  isBestMove?: boolean;
  bestMove?: string;
  scoreChange: number;
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
  ) {}

  /**
   * Анализ игры - ТОЛЬКО GPT, БЕЗ EQUITY
   * GPT анализирует всю игру и оценивает каждый ход пользователя
   */
  async analyzeGame(userId: string, gameId: string): Promise<GameAnalysis> {
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

    if (!this.gptBotService) {
      throw new Error('GPT Bot Service не доступен для анализа.');
    }

    // Вызываем GPT для анализа всей игры
    const gptFullGameAnalysis = await this.gptBotService.analyzeFullGame(
      game,
      moves,
      userId,
      game.mode === GameMode.LONG ? 'long' : 'short',
    );

    const gptAnalysisMap = new Map<number, typeof gptFullGameAnalysis[0]>();
    gptFullGameAnalysis.forEach(analysis => {
      gptAnalysisMap.set(analysis.moveNumber, analysis);
    });

    const allMovesAnalysis: MoveAnalysis[] = [];
    const errors: MoveAnalysis[] = [];
    let mistakes = 0;
    let blunders = 0;
    let inaccuracies = 0;

    // Анализируем каждый ход на основе GPT анализа всей игры
    // НИКАКИХ расчетов equity - только GPT анализ
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isUserMove = move.playerId === userId;
      
      // Получаем GPT анализ для этого хода (если это ход пользователя)
      const gptResultRaw = isUserMove ? gptAnalysisMap.get(move.moveNumber) : null;
      const gptResult = gptResultRaw ? {
        evaluation: gptResultRaw.evaluation,
        explanation: gptResultRaw.explanation,
        reasoning: gptResultRaw.reasoning,
        recommendations: gptResultRaw.recommendations,
        bestMove: gptResultRaw.bestMove,
      } : null;
      
      // Определяем, является ли это первым ходом игры
      const isShortMode = game.mode === GameMode.SHORT;
      const isFirstMoveOfGame = isShortMode 
        ? move.moveNumber === 1 
        : move.moveNumber <= 2;
      
      // Пропускаем анализ ошибок для первых ходов игры
      const shouldAnalyzeErrors = !isFirstMoveOfGame && isUserMove && gptResult;

      // Используем ТОЛЬКО GPT анализ - никаких расчетов equity
      let isError = false;
      let errorType: 'blunder' | 'mistake' | 'inaccuracy' | undefined;
      let errorDescription: string | undefined;

      if (shouldAnalyzeErrors && gptResult) {
        if (gptResult.evaluation === 'blunder' || 
            gptResult.evaluation === 'mistake' || 
            gptResult.evaluation === 'inaccuracy') {
          isError = true;
          errorType = gptResult.evaluation;
          
          // Формируем описание ошибки из GPT анализа
          let description = gptResult.explanation || '';
          if (gptResult.reasoning) {
            if (description) {
              description += ' ' + gptResult.reasoning;
            } else {
              description = gptResult.reasoning;
            }
          }
          
          // Добавляем рекомендации GPT
          if (gptResult.recommendations && gptResult.recommendations.length > 0) {
            description += ' ' + gptResult.recommendations.join('. ');
          }
          
          // Добавляем лучший ход если указан
          if ('bestMove' in gptResult && gptResult.bestMove) {
            description += ` Правильный ход: ${gptResult.bestMove}`;
          }
          
          errorDescription = description.trim();
        }
      }

      const analysis: MoveAnalysis = {
        moveNumber: move.moveNumber,
        move,
        isError,
        errorType,
        errorDescription,
        isBestMove: gptResult?.evaluation === 'excellent',
        bestMove: undefined, // GPT сам определит лучший ход в описании
        scoreChange: 0, // Не используем equity
        gptAnalysis: gptResult ? {
          evaluation: gptResult.evaluation,
          explanation: gptResult.explanation,
          reasoning: gptResult.reasoning,
          recommendations: gptResult.recommendations,
        } : undefined,
      };

      allMovesAnalysis.push(analysis);
      if (isError && isUserMove) {
        errors.push(analysis);
        if (errorType === 'blunder') blunders++;
        else if (errorType === 'mistake') mistakes++;
        else if (errorType === 'inaccuracy') inaccuracies++;
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
