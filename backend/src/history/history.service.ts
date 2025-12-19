import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameStatus } from '../games/game.entity';
import { GameMove } from './game-move.entity';
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
      .andWhere('game.status = :status', { status: GameStatus.FINISHED });

    if (filters?.mode) {
      query.andWhere('game.mode = :mode', { mode: filters.mode });
    }

    if (filters?.result === 'wins') {
      query.andWhere('game.winnerId = :userId', { userId });
    } else if (filters?.result === 'losses') {
      query.andWhere('game.winnerId != :userId AND game.winnerId IS NOT NULL', { userId });
    } else if (filters?.result === 'bot') {
      query.andWhere('game.type = :type', { type: 'vs_bot' });
    }

    // Проверяем подписку для лимита истории
    const hasPremium = await this.subscriptionService.hasActiveSubscription(userId);
    const queryBuilder = query.orderBy('game.createdAt', 'DESC');
    
    // Ограничиваем для бесплатных пользователей
    if (!hasPremium) {
      queryBuilder.limit(this.FREE_USER_HISTORY_LIMIT);
    }

    const games = await queryBuilder.getMany();

    const result = await Promise.all(
      games.map(async (game) => {
        const isPlayer1 = game.player1Id === userId;
        const opponent = isPlayer1 ? game.player2 : game.player1;
        const isWinner = game.winnerId === userId;

        const moveCount = await this.movesRepository.count({ where: { gameId: game.id } });

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
          moves: [], // Загружается отдельно при просмотре реплея
        };
      }),
    );

    return result;
  }

  async getGameReplay(gameId: string): Promise<any> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['player1', 'player2'],
    });

    if (!game) {
      throw new Error('Игра не найдена');
    }

    const moves = await this.movesRepository.find({
      where: { gameId },
      order: { moveNumber: 'ASC' },
      relations: ['player'],
    });

    return {
      game,
      moves,
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
      const movesStr = move.moves.map((m: any) => `${m.from}->${m.to}`).join(';');
      lines.push(`${move.moveNumber},${move.player.username},${move.dice.join(',')},${movesStr}`);
    }

    return lines.join('\n');
  }
}
