import { Injectable, Inject } from '@nestjs/common';
import { GamesService } from '../games/games.service';
import { GameMode, GameType } from '../games/game.entity';
import { RatingsService } from '../ratings/ratings.service';
import Redis from 'ioredis';

interface QueueEntry {
  userId: string;
  mode: GameMode;
  rating: number;
  timestamp: number;
}

@Injectable()
export class MatchmakingService {
  constructor(
    private gamesService: GamesService,
    private ratingsService: RatingsService,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  async joinQueue(userId: string, mode: GameMode): Promise<void> {
    const rating = await this.ratingsService.getRating(userId, mode);
    const entry: QueueEntry = {
      userId,
      mode,
      rating: rating || 1000,
      timestamp: Date.now(),
    };

    await this.redis.zadd(`queue:${mode}`, rating || 1000, JSON.stringify(entry));
    await this.redis.set(`queue:user:${userId}`, JSON.stringify(entry), 'EX', 300);
  }

  async leaveQueue(userId: string): Promise<void> {
    const entryStr = await this.redis.get(`queue:user:${userId}`);
    if (entryStr) {
      const entry: QueueEntry = JSON.parse(entryStr);
      await this.redis.zrem(`queue:${entry.mode}`, JSON.stringify(entry));
      await this.redis.del(`queue:user:${userId}`);
    }
  }

  async findMatch(userId: string, mode: GameMode): Promise<string | null> {
    const userEntryStr = await this.redis.get(`queue:user:${userId}`);
    if (!userEntryStr) {
      return null;
    }

    const userEntry: QueueEntry = JSON.parse(userEntryStr);
    const ratingRange = 200;
    const minRating = userEntry.rating - ratingRange;
    const maxRating = userEntry.rating + ratingRange;

    const candidates = await this.redis.zrangebyscore(
      `queue:${mode}`,
      minRating,
      maxRating,
      'LIMIT',
      0,
      10,
    );

    for (const candidateStr of candidates) {
      const candidate: QueueEntry = JSON.parse(candidateStr);
      if (candidate.userId !== userId) {
        await this.leaveQueue(userId);
        await this.leaveQueue(candidate.userId);
        return candidate.userId;
      }
    }

    return null;
  }

  async createOpenTable(
    userId: string,
    mode: GameMode,
    timeLimit: number,
  ): Promise<string> {
    const game = await this.gamesService.create(userId, null, mode, GameType.VS_PLAYER);
    await this.redis.set(
      `table:${game.id}`,
      JSON.stringify({
        hostId: userId,
        mode,
        timeLimit,
        createdAt: Date.now(),
      }),
      'EX',
      3600,
    );
    return game.id;
  }

  async getOpenTables(mode: GameMode): Promise<any[]> {
    const keys = await this.redis.keys('table:*');
    const tables: any[] = [];

    for (const key of keys) {
      const tableStr = await this.redis.get(key);
      if (tableStr) {
        const table = JSON.parse(tableStr);
        if (table.mode === mode) {
          const gameId = key.replace('table:', '');
          const game = await this.gamesService.findOne(gameId);
          tables.push({
            id: gameId,
            hostId: table.hostId,
            mode: table.mode,
            timeLimit: table.timeLimit,
            createdAt: table.createdAt,
          });
        }
      }
    }

    return tables.sort((a, b) => b.createdAt - a.createdAt);
  }

  async joinTable(gameId: string, userId: string): Promise<void> {
    const tableStr = await this.redis.get(`table:${gameId}`);
    if (!tableStr) {
      throw new Error('Стол не найден');
    }

    const game = await this.gamesService.findOne(gameId);
    if (game.player2Id) {
      throw new Error('Стол уже занят');
    }

    game.player2Id = userId;
    game.status = 'in_progress' as any;
    await this.gamesService['gamesRepository'].save(game);
    await this.redis.del(`table:${gameId}`);
  }
}

