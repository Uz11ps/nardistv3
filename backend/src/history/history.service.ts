import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Game, GameStatus } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class HistoryService {
  private readonly FREE_USER_HISTORY_LIMIT = 10; // Лимит истории для бесплатных пользователей

  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameMove)
    private movesRepository: Repository<GameMove>,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
  ) {}

  async getUserGames(userId: string, filters?: any): Promise<any[]> {
    const query = this.gamesRepository
      .createQueryBuilder('game')
      .leftJoinAndSelect('game.player1', 'player1')
      .leftJoinAndSelect('game.player2', 'player2')
      .where('(game.player1Id = :userId OR game.player2Id = :userId)', { userId })
      .andWhere('game.status = :status', { status: GameStatus.FINISHED })
      .andWhere('game.type != :sandboxType', { sandboxType: 'sandbox' }); // Исключаем sandbox игры из истории

    if (filters?.mode) {
      query.andWhere('game.mode = :mode', { mode: filters.mode });
    }

    if (filters?.result === 'wins') {
      query.andWhere('game.winnerId = :userId', { userId });
    } else if (filters?.result === 'losses') {
      query.andWhere('game.winnerId != :userId AND game.winnerId IS NOT NULL', { userId });
    } else if (filters?.result === 'bot') {
      // Фильтр "бот" должен показывать только игры с ботом, исключая sandbox
      query.andWhere('game.type = :type', { type: 'vs_bot' });
      query.andWhere('game.type != :sandboxType', { sandboxType: 'sandbox' }); // Дополнительная проверка для sandbox
    }

    // Фильтр "только с игроками" - исключаем игры с ботами
    if (filters?.type === 'vs_player') {
      query.andWhere('game.type = :playerType', { playerType: 'vs_player' });
    }

    // Проверяем подписку для лимита истории
    const hasPremium = await this.subscriptionService.hasActiveSubscription(userId);
    const queryBuilder = query.orderBy('game.createdAt', 'DESC');
    
    // Ограничиваем для бесплатных пользователей
    if (!hasPremium) {
      queryBuilder.limit(this.FREE_USER_HISTORY_LIMIT);
    }

    const games = await queryBuilder.getMany();

    // Загружаем все ходы для всех игр одним запросом для оптимизации
    const gameIds = games.map((g) => g.id);
    const allMoves = gameIds.length > 0
      ? await this.movesRepository.find({
          where: { gameId: In(gameIds) },
          order: { moveNumber: 'ASC' },
          relations: ['player'],
        })
      : [];

    // Группируем ходы по играм
    const movesByGame = allMoves.reduce((acc, move) => {
      if (!acc[move.gameId]) {
        acc[move.gameId] = [];
      }
      acc[move.gameId].push(move);
      return acc;
    }, {} as Record<string, GameMove[]>);

    const result = games.map((game) => {
      const isPlayer1 = game.player1Id === userId;
      const opponent = isPlayer1 ? game.player2 : game.player1;
      const isWinner = game.winnerId === userId;
      const moves = movesByGame[game.id] || [];

      return {
        id: game.id,
        mode: game.mode,
        type: game.type,
        opponent: opponent
          ? {
              id: opponent.id,
              username: opponent.username,
              nickname: opponent.nickname,
              avatarUrl: opponent.avatarUrl,
            }
          : { id: 'bot', username: 'Бот' },
        result: isWinner ? 'win' : game.winnerId ? 'loss' : 'draw',
        score: { player1: game.player1Score, player2: game.player2Score },
        duration: game.updatedAt
          ? Math.floor((game.updatedAt.getTime() - game.createdAt.getTime()) / 1000)
          : 0,
        createdAt: game.createdAt.toISOString(),
        updatedAt: game.updatedAt ? game.updatedAt.toISOString() : null,
        finishedAt: game.updatedAt ? game.updatedAt.toISOString() : null,
        moveCount: moves.length,
        stake: game.stake || 0,
        // Базовая информация о ходах для отображения в списке
        moves: moves.map((move) => ({
          moveNumber: move.moveNumber,
          playerId: move.playerId,
          playerUsername: move.player?.username || 'Unknown',
          dice: move.dice,
          movesCount: move.moves?.length || 0,
          createdAt: move.createdAt.toISOString(),
        })),
        // Финальное состояние игры (если нужно)
        finalGameState: game.gameState || null,
        winnerId: game.winnerId,
      };
    });

    return result;
  }

  async getGameReplay(gameId: string, step?: number): Promise<any> {
    // Загружаем игру со всеми связями
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['player1', 'player2', 'moves', 'moves.player'],
    });

    if (!game) {
      throw new Error('Игра не найдена');
    }

    // Если ходы не загрузились через relations, загружаем отдельно
    let moves = game.moves || [];
    if (moves.length === 0) {
      moves = await this.movesRepository.find({
        where: { gameId },
        order: { moveNumber: 'ASC' },
        relations: ['player'],
      });
    } else {
      // Сортируем ходы по номеру, если они уже загружены
      moves.sort((a, b) => a.moveNumber - b.moveNumber);
    }

    // Определяем текущее состояние на основе step
    let currentGameState = game.gameState || null; // Начальное состояние
    let currentStep = step !== undefined ? step : moves.length; // По умолчанию показываем финальное состояние
    
    if (currentStep === 0) {
      // Начальное состояние
      currentGameState = game.gameState || null;
    } else if (currentStep > 0 && currentStep <= moves.length) {
      // Состояние после хода currentStep
      const move = moves[currentStep - 1];
      currentGameState = move.gameStateAfter || game.gameState || null;
    } else if (currentStep > moves.length) {
      // Если step больше количества ходов, показываем финальное состояние
      currentStep = moves.length;
      if (moves.length > 0) {
        const lastMove = moves[moves.length - 1];
        currentGameState = lastMove.gameStateAfter || game.gameState || null;
      }
    }

    return {
      game: {
        id: game.id,
        mode: game.mode,
        type: game.type,
        status: game.status,
        player1Id: game.player1Id,
        player2Id: game.player2Id,
        player1: game.player1 ? {
          id: game.player1.id,
          username: game.player1.username,
          nickname: game.player1.nickname,
          avatarUrl: game.player1.avatarUrl,
        } : null,
        player2: game.player2 ? {
          id: game.player2.id,
          username: game.player2.username,
          nickname: game.player2.nickname,
          avatarUrl: game.player2.avatarUrl,
        } : null,
        player1Score: game.player1Score,
        player2Score: game.player2Score,
        winnerId: game.winnerId,
        createdAt: game.createdAt.toISOString(),
        updatedAt: game.updatedAt ? game.updatedAt.toISOString() : null,
        initialGameState: game.gameState,
        rngSeed: game.rngSeed,
        rngHash: game.rngHash,
      },
      moves: moves.map((move) => ({
        id: move.id,
        moveNumber: move.moveNumber,
        player: move.player ? {
          id: move.player.id,
          username: move.player.username,
          nickname: move.player.nickname,
        } : {
          id: null,
          username: 'Бот',
          nickname: null,
        },
        playerId: move.playerId,
        dice: move.dice || [],
        moves: move.moves || [],
        gameStateBefore: move.gameStateBefore || null,
        gameStateAfter: move.gameStateAfter || null,
        moveTimeMs: move.moveTimeMs || null,
        createdAt: move.createdAt ? move.createdAt.toISOString() : new Date().toISOString(),
      })),
      currentStep,
      totalSteps: moves.length,
      currentGameState, // Текущее состояние для отображения
    };
  }

  async exportGameJSON(gameId: string): Promise<string> {
    const replay = await this.getGameReplay(gameId);
    return JSON.stringify(replay, null, 2);
  }

  async exportGameCSV(gameId: string): Promise<string> {
    const replay = await this.getGameReplay(gameId);
    const lines = ['Move,Player,Dice,Moves'];
    
    for (const move of replay.moves) {
      const movesStr = (move.moves || []).map((m: any) => `${m.from}->${m.to}`).join(';');
      const playerName = move.player?.username || 'Бот';
      lines.push(`${move.moveNumber},${playerName},${(move.dice || []).join(',')},${movesStr}`);
    }

    return lines.join('\n');
  }
}
