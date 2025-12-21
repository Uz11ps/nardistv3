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

  /**
   * Проверяет, находится ли игрок уже в активной игре (исключая finished, abandoned и игры с ботом)
   */
  async isUserInActiveGame(userId: string): Promise<{ isInGame: boolean; gameId?: string }> {
    // Ищем игры где пользователь является player1 или player2 и статус waiting или in_progress
    // Исключаем finished и abandoned игры, а также игры с ботом
    const activeGames = await this.gamesService['gamesRepository'].find({
      where: [
        { player1Id: userId, status: 'waiting' as any },
        { player1Id: userId, status: 'in_progress' as any },
        { player2Id: userId, status: 'waiting' as any },
        { player2Id: userId, status: 'in_progress' as any },
      ],
    });

    // Фильтруем только действительно активные игры:
    // - исключаем finished и abandoned
    // - исключаем игры с ботом (type === 'vs_bot')
    const trulyActiveGames = activeGames.filter(game => 
      (game.status === 'waiting' || game.status === 'in_progress') && 
      game.type !== 'vs_bot'
    );

    if (trulyActiveGames.length > 0) {
      return { isInGame: true, gameId: trulyActiveGames[0].id };
    }

    return { isInGame: false };
  }

  async joinQueue(userId: string, mode: GameMode): Promise<void> {
    // Проверяем, не находится ли игрок уже в активной игре
    const activeGameCheck = await this.isUserInActiveGame(userId);
    if (activeGameCheck.isInGame) {
      throw new Error('Вы уже находитесь в активной игре. Завершите текущую игру перед поиском новой.');
    }

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
    // Проверяем, не находится ли игрок уже в активной игре
    const activeGameCheck = await this.isUserInActiveGame(userId);
    if (activeGameCheck.isInGame) {
      throw new Error('Вы уже находитесь в активной игре. Завершите текущую игру перед созданием новой.');
    }

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
          try {
            const game = await this.gamesService.findOne(gameId);
            // Показываем стол только если игра в статусе WAITING (ожидание соперника или готовности)
            if (game.status === 'waiting') {
              tables.push({
                id: gameId,
                hostId: table.hostId,
                mode: table.mode,
                timeLimit: table.timeLimit,
                createdAt: table.createdAt,
                stake: Number(game.stake) || 0,
                playerCount: game.player2Id ? 2 : 1,
                maxPlayers: 2,
                status: 'waiting',
              });
            }
          } catch (error) {
            // Если игра не найдена, пропускаем этот стол
            continue;
          }
        }
      }
    }

    return tables.sort((a, b) => b.createdAt - a.createdAt);
  }

  async joinTable(gameId: string, userId: string): Promise<void> {
    // Проверяем, не находится ли игрок уже в активной игре
    const activeGameCheck = await this.isUserInActiveGame(userId);
    if (activeGameCheck.isInGame && activeGameCheck.gameId !== gameId) {
      throw new Error('Вы уже находитесь в активной игре. Завершите текущую игру перед присоединением к другому столу.');
    }

    const tableStr = await this.redis.get(`table:${gameId}`);
    if (!tableStr) {
      throw new Error('Стол не найден');
    }

    // Проверяем, не заблокирован ли этот игрок от этого стола
    const blockedKey = `game:${gameId}:blocked:${userId}`;
    const isBlocked = await this.redis.exists(blockedKey);
    if (isBlocked) {
      throw new Error('Вы были исключены из этого стола из-за таймаута');
    }

    const game = await this.gamesService.findOne(gameId);
    if (game.player2Id) {
      throw new Error('Стол уже занят');
    }

    game.player2Id = userId;
    // Статус остается WAITING до тех пор, пока оба игрока не будут готовы
    // game.status остается 'waiting'
    await this.gamesService['gamesRepository'].save(game);
    
    // Создаем запись о готовности игроков в Redis
    await this.redis.set(`game:${gameId}:ready`, JSON.stringify({
      player1Ready: false,
      player2Ready: false,
    }), 'EX', 3600);
    
    // Сохраняем время присоединения игрока для таймаута (60 секунд)
    await this.redis.set(`game:${gameId}:joined:${userId}`, Date.now().toString(), 'EX', 120);
    
    // Стол НЕ удаляем из списка открытых - он остается видимым пока игра в статусе WAITING
    // Стол удалится только когда игра начнется (статус IN_PROGRESS) или завершится
  }

  async setPlayerReady(gameId: string, userId: string): Promise<{ bothReady: boolean; player1Ready: boolean; player2Ready: boolean }> {
    const game = await this.gamesService.findOne(gameId);
    if (game.player1Id !== userId && game.player2Id !== userId) {
      throw new Error('Вы не участник этой игры');
    }

    const readyKey = `game:${gameId}:ready`;
    const readyStr = await this.redis.get(readyKey);
    const ready = readyStr ? JSON.parse(readyStr) : { player1Ready: false, player2Ready: false };

    if (game.player1Id === userId) {
      ready.player1Ready = true;
    } else if (game.player2Id === userId) {
      ready.player2Ready = true;
    }

    await this.redis.set(readyKey, JSON.stringify(ready), 'EX', 3600);

    const bothReady = ready.player1Ready && ready.player2Ready;
    
    return {
      bothReady,
      player1Ready: ready.player1Ready,
      player2Ready: ready.player2Ready,
    };
  }

  /**
   * Удаляет стол из Redis (когда игра началась или завершилась)
   */
  async deleteTableFromRedis(gameId: string): Promise<void> {
    await this.redis.del(`table:${gameId}`);
  }

  async blockPlayerFromTable(gameId: string, userId: string): Promise<void> {
    await this.redis.set(`game:${gameId}:blocked:${userId}`, '1', 'EX', 3600);
  }

  async getReadyStatus(gameId: string): Promise<{ player1Ready: boolean; player2Ready: boolean } | null> {
    const readyKey = `game:${gameId}:ready`;
    const readyStr = await this.redis.get(readyKey);
    return readyStr ? JSON.parse(readyStr) : null;
  }

  async reopenTable(gameId: string, hostId: string, mode: GameMode, timeLimit: number, createdAt: number): Promise<void> {
    await this.redis.set(
      `table:${gameId}`,
      JSON.stringify({
        hostId,
        mode,
        timeLimit,
        createdAt,
      }),
      'EX',
      3600,
    );
  }

  async clearReadyStatus(gameId: string): Promise<void> {
    await this.redis.del(`game:${gameId}:ready`);
  }
}

