import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { GamesService } from '../games/games.service';
import { GameMode, GameType } from '../games/game.entity';
import { RatingsService } from '../ratings/ratings.service';
import { SubscriptionService } from '../subscription/subscription.service';
import Redis from 'ioredis';

interface QueueEntry {
  userId: string;
  mode: GameMode;
  rating: number;
  timestamp: number;
  isPremium?: boolean; // Приоритет для премиум
}

@Injectable()
export class MatchmakingService {
  constructor(
    private gamesService: GamesService,
    private ratingsService: RatingsService,
    @Inject('REDIS_CLIENT') private redis: Redis,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
  ) {}

  async joinQueue(userId: string, mode: GameMode): Promise<void> {
    const rating = await this.ratingsService.getRating(userId, mode);
    const isPremium = await this.subscriptionService.hasActiveSubscription(userId);
    
    // Премиум пользователи получают приоритет через более высокий score
    // Добавляем 100000 к рейтингу для сортировки (но используем реальный рейтинг для подбора)
    const queueScore = isPremium ? (rating || 1000) + 100000 : (rating || 1000);
    
    const entry: QueueEntry = {
      userId,
      mode,
      rating: rating || 1000,
      timestamp: Date.now(),
      isPremium,
    };

    await this.redis.zadd(`queue:${mode}`, queueScore, JSON.stringify(entry));
    await this.redis.set(`queue:user:${userId}`, JSON.stringify(entry), 'EX', 300);
  }

  async leaveQueue(userId: string): Promise<void> {
    const entryStr = await this.redis.get(`queue:user:${userId}`);
    if (entryStr) {
      const entry: QueueEntry = JSON.parse(entryStr);
      
      // Получаем все записи из очереди и удаляем нужную по userId
      const queueKey = `queue:${entry.mode}`;
      const allEntries = await this.redis.zrange(queueKey, 0, -1);
      
      for (const candidateStr of allEntries) {
        try {
          const candidate: QueueEntry = JSON.parse(candidateStr);
          if (candidate.userId === userId) {
            // Удаляем по точному совпадению строки
            await this.redis.zrem(queueKey, candidateStr);
            break;
          }
        } catch (error) {
          // Пропускаем некорректные записи
          continue;
        }
      }
      
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

    // Получаем больше кандидатов через zrange (по score с учетом премиум)
    // Премиум пользователи будут выше в списке из-за большего score
    const allCandidates = await this.redis.zrange(`queue:${mode}`, 0, 50, 'REV');
    
    // Фильтруем по реальному рейтингу (не по score)
    const candidatesInRange: QueueEntry[] = [];
    for (const candidateStr of allCandidates) {
      try {
        const candidate: QueueEntry = JSON.parse(candidateStr);
        // Проверяем реальный рейтинг, а не score
        if (candidate.userId !== userId && 
            candidate.mode === mode &&
            candidate.rating >= minRating && 
            candidate.rating <= maxRating) {
          candidatesInRange.push(candidate);
        }
      } catch (error) {
        // Пропускаем некорректные записи
        continue;
      }
    }

    // Премиум пользователи имеют приоритет - проверяем их первыми
    const premiumCandidates = candidatesInRange.filter(c => c.isPremium === true);
    const candidatesToCheck = premiumCandidates.length > 0 ? premiumCandidates : candidatesInRange;

    // Берем первого подходящего кандидата
    for (const candidate of candidatesToCheck) {
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
            stake: Number(game.stake) || 0,
            playerCount: game.player2Id ? 2 : 1,
            maxPlayers: 2,
            status: game.status === 'waiting' ? 'waiting' : 'in_progress',
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

