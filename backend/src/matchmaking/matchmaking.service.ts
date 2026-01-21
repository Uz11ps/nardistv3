import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamesService } from '../games/games.service';
import { GameMode, GameType, GameStatus } from '../games/game.entity';
import { RatingsService } from '../ratings/ratings.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { UsersService } from '../users/users.service';
import { TournamentMatch } from '../tournaments/tournament-match.entity';
import { TournamentStatus } from '../tournaments/tournament.entity';
import { SystemSettings } from '../admin/system-settings.entity';
import Redis from 'ioredis';

interface QueueEntry {
  userId: string;
  mode: GameMode;
  rating: number;
  timestamp: number;
  isPremium?: boolean; // Приоритет для премиум
  timeLimit?: number;
  stake?: number;
  matchesToWin?: number;
}

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    private gamesService: GamesService,
    private ratingsService: RatingsService,
    @Inject('REDIS_CLIENT') private redis: Redis,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    @InjectRepository(SystemSettings)
    private systemSettingsRepository: Repository<SystemSettings>,
  ) {}

  /**
   * Проверяет, находится ли игрок уже в активной игре (исключая finished, abandoned и игры с ботом)
   * Также исключает игры из завершенных турниров или игры, где игрок уже выбыл
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
    // - исключаем sandbox игры (type === 'sandbox')
    // - исключаем игры из завершенных турниров или игры, где игрок уже выбыл
    const trulyActiveGames = [];
    
    for (const game of activeGames) {
      if (game.status !== 'waiting' && game.status !== 'in_progress') continue;
      if (game.type === 'vs_bot' || game.type === 'sandbox') continue;
      
      // Для турнирных игр проверяем статус турнира и выбытие игрока
      if (game.type === 'tournament') {
        try {
          // Используем connection manager для получения репозитория TournamentMatch
          const connection = this.gamesService['gamesRepository'].manager.connection;
          const matchRepo = connection.getRepository(TournamentMatch);
          
          const match = await matchRepo.findOne({
            where: { gameId: game.id },
            relations: ['tournament'],
          });
          
          if (match && match.tournament) {
            // Если турнир завершен - игра не активна
            if (match.tournament.status === TournamentStatus.FINISHED || match.tournament.status === TournamentStatus.CANCELLED) {
              continue;
            }
            
            // Проверяем, не выбыл ли игрок (нет активных матчей с участием игрока)
            const playerMatches = await matchRepo.find({
              where: [
                { tournamentId: match.tournament.id, player1Id: userId },
                { tournamentId: match.tournament.id, player2Id: userId },
              ],
            });
            
            // Если все матчи игрока завершены и он не победитель - выбыл
            const hasActiveMatch = playerMatches.some(m => 
              m.status === 'scheduled' || m.status === 'in_progress'
            );
            
            if (!hasActiveMatch) {
              // Проверяем, не является ли игрок победителем турнира
              if (match.tournament.winnerId !== userId) {
                continue; // Игрок выбыл
              }
            }
          }
        } catch (error) {
          // Если не удалось проверить - считаем игру активной (безопаснее)
          this.logger.warn(`Не удалось проверить статус турнира для игры ${game.id}:`, error);
        }
      }
      
      trulyActiveGames.push(game);
    }

    if (trulyActiveGames.length > 0) {
      return { isInGame: true, gameId: trulyActiveGames[0].id };
    }

    return { isInGame: false };
  }

  async joinQueue(userId: string, mode: GameMode, timeLimit?: number, stake?: number, matchesToWin?: number): Promise<void> {
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
    
    // Нормализуем stake (защита от NaN, null, undefined)
    const normalizedStake = (stake !== null && stake !== undefined && !isNaN(stake)) ? Math.max(0, Number(stake)) : 0;
    
    const entry: QueueEntry = {
      userId,
      mode,
      rating: rating || 1000,
      timestamp: Date.now(),
      isPremium,
      timeLimit: timeLimit || 60,
      stake: normalizedStake,
      matchesToWin: matchesToWin || 1,
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

  /**
   * Получить статистику очереди и активных игр
   */
  async getQueueStats(): Promise<{
    longQueue: number;
    shortQueue: number;
    activeGames: number;
  }> {
    // Подсчитываем количество игроков в очереди для каждого режима
    const longQueueEntries = await this.redis.zrange(`queue:${GameMode.LONG}`, 0, -1);
    const shortQueueEntries = await this.redis.zrange(`queue:${GameMode.SHORT}`, 0, -1);
    
    // Подсчитываем уникальных игроков (на случай дубликатов)
    const longQueueSet = new Set<string>();
    const shortQueueSet = new Set<string>();
    
    for (const entryStr of longQueueEntries) {
      try {
        const entry: QueueEntry = JSON.parse(entryStr);
        longQueueSet.add(entry.userId);
      } catch (error) {
        continue;
      }
    }
    
    for (const entryStr of shortQueueEntries) {
      try {
        const entry: QueueEntry = JSON.parse(entryStr);
        shortQueueSet.add(entry.userId);
      } catch (error) {
        continue;
      }
    }
    
    // Подсчитываем активные игры
    const activeGames = await this.gamesService.countActiveGames();
    
    return {
      longQueue: longQueueSet.size,
      shortQueue: shortQueueSet.size,
      activeGames,
    };
  }

  async findMatch(userId: string, mode: GameMode): Promise<{ opponentId: string; timeLimit: number; stake: number; matchesToWin: number } | null> {
    const userEntryStr = await this.redis.get(`queue:user:${userId}`);
    if (!userEntryStr) {
      return null;
    }

    const userEntry: QueueEntry = JSON.parse(userEntryStr);
    
    // Получаем настройку разброса рейтинга из БД
    const ratingRangeSetting = await this.systemSettingsRepository.findOne({ where: { key: 'matchmaking_rating_range' } });
    const ratingRange = ratingRangeSetting ? parseInt(ratingRangeSetting.value) : 500;
    
    const minRating = userEntry.rating - ratingRange;
    const maxRating = userEntry.rating + ratingRange;

    // Получаем больше кандидатов через zrange (по score с учетом премиум)
    // Премиум пользователи будут выше в списке из-за большего score
    const allCandidates = await this.redis.zrange(`queue:${mode}`, 0, 50, 'REV');
    
    // Фильтруем по реальному рейтингу (не по score) и совпадению параметров
    const candidatesInRange: QueueEntry[] = [];
    for (const candidateStr of allCandidates) {
      try {
        const candidate: QueueEntry = JSON.parse(candidateStr);
        // Проверяем реальный рейтинг, а не score
        // Также проверяем совпадение timeLimit и stake
        if (candidate.userId !== userId && 
            candidate.mode === mode &&
            candidate.rating >= minRating && 
            candidate.rating <= maxRating &&
            candidate.timeLimit === userEntry.timeLimit &&
            candidate.stake === userEntry.stake &&
            (candidate.matchesToWin || 1) === (userEntry.matchesToWin || 1)) {
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
        return {
          opponentId: candidate.userId,
          timeLimit: candidate.timeLimit || 60,
          stake: candidate.stake || 0,
          matchesToWin: candidate.matchesToWin || 1,
        };
      }
    }

    return null;
  }

  async createOpenTable(
    userId: string,
    mode: GameMode,
    timeLimit: number,
    stake: number = 0,
    matchesToWin: number = 1,
  ): Promise<string> {
    // Проверяем, не находится ли игрок уже в активной игре
    const activeGameCheck = await this.isUserInActiveGame(userId);
    if (activeGameCheck.isInGame) {
      throw new Error('Вы уже находитесь в активной игре. Завершите текущую игру перед созданием новой.');
    }

    // Проверяем и нормализуем stake (защита от NaN, null, undefined)
    const normalizedStake = (stake !== null && stake !== undefined && !isNaN(stake)) ? Math.max(0, Number(stake)) : 0;
    
    const moveTimeLimit = timeLimit * 1000; // Конвертируем секунды в миллисекунды
    const game = await this.gamesService.create(userId, null, mode, GameType.VS_PLAYER, normalizedStake, moveTimeLimit, matchesToWin);
    
    // Проверяем, что игра создана со статусом WAITING
    if (game.status !== GameStatus.WAITING) {
      throw new Error(`Игра создана со статусом ${game.status}, ожидался WAITING`);
    }
    
    const tableData = {
      hostId: userId,
      mode,
      timeLimit,
      stake: normalizedStake,
      createdAt: Date.now(),
    };
    
    await this.redis.set(
      `table:${game.id}`,
      JSON.stringify(tableData),
      'EX',
      3600,
    );
    
    // Проверяем, что ключ сохранен
    const savedTable = await this.redis.get(`table:${game.id}`);
    if (!savedTable) {
      throw new Error('Не удалось сохранить стол в Redis');
    }
    
    return game.id;
  }

  async getOpenTables(mode?: GameMode): Promise<any[]> {
    try {
      const keys = await this.redis.keys('table:*');
      const tables: any[] = [];

      for (const key of keys) {
        try {
          const tableStr = await this.redis.get(key);
          if (!tableStr) {
            continue;
          }

          const table = JSON.parse(tableStr);
          // Если mode указан, фильтруем по режиму, иначе показываем все
          if (mode && table.mode !== mode) {
            continue;
          }

          const gameId = key.replace('table:', '');
          try {
            const game = await this.gamesService.findOne(gameId);
            // Показываем стол только если игра в статусе WAITING (ожидание соперника или готовности)
            if (game && game.status === GameStatus.WAITING) {
              // Нормализуем stake (защита от NaN, null, undefined, bigint)
              const stakeValue = game.stake !== null && game.stake !== undefined 
                ? (typeof game.stake === 'bigint' ? Number(game.stake) : Number(game.stake))
                : 0;
              const normalizedStake = (!isNaN(stakeValue) && isFinite(stakeValue)) ? Math.max(0, stakeValue) : 0;
              
              tables.push({
                id: gameId,
                hostId: table.hostId,
                mode: table.mode,
                timeLimit: table.timeLimit,
                createdAt: table.createdAt,
                stake: normalizedStake,
                playerCount: game.player2Id ? 2 : 1,
                maxPlayers: 2,
                status: 'waiting',
              });
            }
          } catch (error) {
            // Если игра не найдена, пропускаем этот стол
            // Возможно, игра была удалена или стол устарел
            continue;
          }
        } catch (error) {
          // Ошибка парсинга JSON или получения из Redis - пропускаем
          continue;
        }
      }

      const sortedTables = tables.sort((a, b) => b.createdAt - a.createdAt);
      return sortedTables;
    } catch (error) {
      // Критическая ошибка - возвращаем пустой массив
      console.error('Ошибка при получении списка столов:', error);
      return [];
    }
  }

  async joinTable(gameId: string, userId: string): Promise<void> {
    // Проверяем, не находится ли игрок уже в активной игре
    const activeGameCheck = await this.isUserInActiveGame(userId);
    if (activeGameCheck.isInGame && activeGameCheck.gameId !== gameId) {
      throw new Error('Вы уже находитесь в активной игре. Завершите текущую игру перед присоединением к другому столу.');
    }

    // Проверяем существование стола в Redis
    const tableStr = await this.redis.get(`table:${gameId}`);
    if (!tableStr) {
      throw new Error('Стол не найден или уже закрыт');
    }

    // Проверяем, не заблокирован ли этот игрок от этого стола
    const blockedKey = `game:${gameId}:blocked:${userId}`;
    const isBlocked = await this.redis.exists(blockedKey);
    if (isBlocked) {
      throw new Error('Вы были исключены из этого стола из-за таймаута');
    }

    // Получаем игру из БД
    const game = await this.gamesService.findOne(gameId);
    
    // Проверяем статус игры
    if (game.status !== GameStatus.WAITING) {
      throw new Error(`Стол недоступен. Статус игры: ${game.status}`);
    }

    // Проверяем, не занят ли стол
    if (game.player2Id) {
      if (game.player2Id === userId) {
        // Игрок уже присоединен к этому столу
        return;
      }
      throw new Error('Стол уже занят');
    }

    // Проверяем, что игрок не является создателем стола
    if (game.player1Id === userId) {
      throw new Error('Вы не можете присоединиться к своему собственному столу');
    }

    // Если игра на ставки, списываем ставку у второго игрока
    if (game.stake > 0 && game.type === GameType.VS_PLAYER) {
      const player2 = await this.usersService.findOne(userId);
      const player2Balance = Number(player2.narCoin);
      if (player2Balance < game.stake) {
        throw new Error('Недостаточно NAR-coin для ставки');
      }
      const newPlayer2Balance = player2Balance - Number(game.stake);
      await this.usersService.update(userId, { narCoin: newPlayer2Balance });
      this.logger.log(`💰 Ставка списана у игрока ${userId}: -${game.stake} NAR (было ${player2Balance}, стало ${newPlayer2Balance})`);
    }

    // Присоединяем игрока
    game.player2Id = userId;
    // Статус остается WAITING до тех пор, пока оба игрока не будут готовы
    await this.gamesService['gamesRepository'].save(game);
    
    // Создаем запись о готовности игроков в Redis (если еще не создана)
    const readyKey = `game:${gameId}:ready`;
    const existingReady = await this.redis.get(readyKey);
    if (!existingReady) {
      await this.redis.set(readyKey, JSON.stringify({
        player1Ready: false,
        player2Ready: false,
      }), 'EX', 3600);
    }
    
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

