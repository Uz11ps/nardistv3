import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './rating.entity';
import { GameMode, GameStatus, GameType } from '../games/game.entity';
import { SystemSettings } from '../admin/system-settings.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { Game } from '../games/game.entity';

@Injectable()
export class RatingsService {
  private readonly K_FACTOR = 32;

  constructor(
    @InjectRepository(Rating)
    private ratingsRepository: Repository<Rating>,
    @InjectRepository(SystemSettings)
    private systemSettingsRepository: Repository<SystemSettings>,
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
  ) {}

  async getRating(userId: string, mode: GameMode): Promise<number | null> {
    const rating = await this.ratingsRepository.findOne({
      where: { userId, mode },
    });
    return rating ? rating.elo : null;
  }

  async getOrCreateRating(userId: string, mode: GameMode): Promise<Rating> {
    let rating = await this.ratingsRepository.findOne({
      where: { userId, mode },
    });

    if (!rating) {
      rating = this.ratingsRepository.create({
        userId,
        mode,
        elo: 1000,
      });
      rating = await this.ratingsRepository.save(rating);
    }

    return rating;
  }

  async updateRatings(
    winnerId: string,
    loserId: string,
    mode: GameMode,
    isDraw: boolean = false,
  ): Promise<void> {
    const winnerRating = await this.getOrCreateRating(winnerId, mode);
    const loserRating = await this.getOrCreateRating(loserId, mode);

    const winnerElo = winnerRating.elo;
    const loserElo = loserRating.elo;
    const ratingDiff = winnerElo - loserElo;

    if (isDraw) {
      // При ничьей оба игрока получают/теряют одинаково
      const drawPoints = 0; // Ничья не меняет рейтинг
      winnerRating.elo = Math.round(winnerRating.elo + drawPoints);
      loserRating.elo = Math.round(loserRating.elo + drawPoints);
      winnerRating.draws++;
      loserRating.draws++;
    } else {
      // Новая система: дефолт 25/25, максимальный разброс -35/+15
      // Игрок с большим рейтингом получает меньше при победе и теряет больше при поражении
      
      // Получаем настройки из БД
      const basePointsSetting = await this.systemSettingsRepository.findOne({ where: { key: 'matchmaking_base_points' } });
      const maxBonusSetting = await this.systemSettingsRepository.findOne({ where: { key: 'matchmaking_max_bonus' } });
      const maxPenaltySetting = await this.systemSettingsRepository.findOne({ where: { key: 'matchmaking_max_penalty' } });
      
      const basePoints = basePointsSetting ? parseInt(basePointsSetting.value) : 25;
      const maxBonus = maxBonusSetting ? parseInt(maxBonusSetting.value) : 10; // Максимальный бонус для слабого игрока (+10 к базовым 25 = +35)
      const maxPenalty = maxPenaltySetting ? parseInt(maxPenaltySetting.value) : 10; // Максимальный штраф для сильного игрока (-10 от базовых 25 = +15)
      
      // Получаем максимальную разницу рейтинга из настроек матчмейкинга
      const ratingRangeSetting = await this.systemSettingsRepository.findOne({ where: { key: 'matchmaking_rating_range' } });
      const maxRatingRange = ratingRangeSetting ? parseInt(ratingRangeSetting.value) : 500;
      
      // Нормализуем разницу рейтинга в диапазон [-maxRatingRange, maxRatingRange] для расчета множителя
      const normalizedDiff = Math.max(-maxRatingRange, Math.min(maxRatingRange, ratingDiff));
      const multiplier = normalizedDiff / maxRatingRange; // От -1 до 1
      
      // Вычисляем изменение рейтинга для победителя
      // Если победитель сильнее (ratingDiff > 0, multiplier > 0), он получает меньше
      // Если победитель слабее (ratingDiff < 0, multiplier < 0), он получает больше
      // multiplier = ratingDiff / maxRatingRange, поэтому:
      // - Если ratingDiff = maxRatingRange (победитель намного сильнее), multiplier = 1, получает basePoints - maxPenalty
      // - Если ratingDiff = -maxRatingRange (победитель намного слабее), multiplier = -1, получает basePoints + maxPenalty
      // - Если ratingDiff = 0 (равные), multiplier = 0, получает basePoints
      const winnerPointsChange = basePoints - (multiplier * maxPenalty);
      
      // Вычисляем изменение рейтинга для проигравшего (симметрично)
      // Если проигравший сильнее (ratingDiff < 0, multiplier < 0), он теряет больше (-25 - 10 = -35)
      // Если проигравший слабее (ratingDiff > 0, multiplier > 0), он теряет меньше (-25 + 10 = -15)
      const loserPointsChange = -basePoints - (multiplier * maxPenalty);
      
      // Округляем и применяем изменения
      winnerRating.elo = Math.round(winnerRating.elo + winnerPointsChange);
      loserRating.elo = Math.round(loserRating.elo + loserPointsChange);
      
      // Убеждаемся, что рейтинг не уходит ниже 0
      winnerRating.elo = Math.max(0, winnerRating.elo);
      loserRating.elo = Math.max(0, loserRating.elo);
      
      winnerRating.wins++;
      loserRating.losses++;
    }

    await this.ratingsRepository.save([winnerRating, loserRating]);
  }

  private calculateExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  async getLeaderboard(
    mode: GameMode, 
    period: string = 'all', 
    sortBy: 'xp' | 'matches' | 'winrate' | 'rating' = 'rating',
    limit: number = 100
  ): Promise<any[]> {
    let periodStart: Date | null = null;
    if (period === 'weekly') {
      periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 7);
      periodStart.setHours(0, 0, 0, 0); // Начало дня недели назад
    } else if (period === 'monthly') {
      periodStart = new Date();
      periodStart.setMonth(periodStart.getMonth() - 1);
      periodStart.setHours(0, 0, 0, 0); // Начало дня месяц назад
    } else if (period === 'all') {
      // Для "all" устанавливаем очень старую дату, чтобы получить все игры
      periodStart = new Date(0); // 1970-01-01
    }

    // Всегда считаем статистику из игр (для всех периодов и типов сортировки)
    return this.getLeaderboardFromGames(mode, periodStart!, sortBy, limit, period === 'all');
  }

  private async getLeaderboardFromGames(
    mode: GameMode,
    periodStart: Date,
    sortBy: 'xp' | 'matches' | 'winrate' | 'rating',
    limit: number,
    isAllPeriod: boolean = false
  ): Promise<any[]> {
    // Получаем все игры за период (только vs_player)
    // Используем createdAt для фильтрации, так как это дата начала игры
    // Игра считается за период, если она была создана в этот период
    const games = await this.gamesRepository
      .createQueryBuilder('game')
      .leftJoinAndSelect('game.player1', 'player1')
      .leftJoinAndSelect('game.player2', 'player2')
      .where('game.mode = :mode', { mode })
      .andWhere('game.type = :type', { type: GameType.VS_PLAYER })
      .andWhere('game.status = :status', { status: GameStatus.FINISHED })
      .andWhere('game.createdAt >= :periodStart', { periodStart })
      .getMany();

    // Если игр нет, возвращаем пустой массив
    if (games.length === 0) {
      return [];
    }

    // Собираем статистику по пользователям
    const userStats = new Map<string, {
      userId: string;
      user: any;
      matches: number;
      wins: number;
      losses: number;
      xp: number;
    }>();

    for (const game of games) {
      // Обрабатываем player1
      if (game.player1) {
        const stats = userStats.get(game.player1.id) || {
          userId: game.player1.id,
          user: game.player1,
          matches: 0,
          wins: 0,
          losses: 0,
          xp: 0,
        };
        stats.matches++;
        if (game.winnerId === game.player1.id) {
          stats.wins++;
        } else if (game.winnerId) {
          stats.losses++;
        }
        stats.xp += Number(game.player1XP || 0);
        userStats.set(game.player1.id, stats);
      }

      // Обрабатываем player2
      if (game.player2) {
        const stats = userStats.get(game.player2.id) || {
          userId: game.player2.id,
          user: game.player2,
          matches: 0,
          wins: 0,
          losses: 0,
          xp: 0,
        };
        stats.matches++;
        if (game.winnerId === game.player2.id) {
          stats.wins++;
        } else if (game.winnerId) {
          stats.losses++;
        }
        stats.xp += Number(game.player2XP || 0);
        userStats.set(game.player2.id, stats);
      }
    }

    // Формируем entries
    const entries = await Promise.all(Array.from(userStats.values()).map(async (stats) => {
      // Винрейт всегда считается из игр за период
      const winRate = stats.matches > 0 
        ? Math.round((stats.wins / stats.matches) * 100 * 10) / 10 
        : 0;
      
      // Получаем рейтинг пользователя
      const rating = await this.getRating(stats.userId, mode) || 1000;
      
      // Для периода "all" берем общий XP пользователя, для других периодов - прирост XP из игр за период
      let xp = stats.xp; // Это уже сумма XP из игр за период для weekly/monthly
      if (isAllPeriod) {
        // Для периода "all" используем общий XP пользователя из базы
        xp = Number(stats.user.xp || 0);
      }
      // Для weekly/monthly xp уже содержит прирост (сумму XP из игр за период)
      
      // Для рейтинга считаем изменение за период (только если не период "all")
      let ratingChange = undefined;
      if (sortBy === 'rating' && !isAllPeriod) {
        // Считаем изменение на основе игр за период
        // Упрощенно: победа +25, поражение -25
        ratingChange = (stats.wins * 25) - (stats.losses * 25);
      }
      
      const hasPremium = await this.subscriptionService.hasActiveSubscription(stats.userId);
      
      return {
        user: {
          id: stats.user.id,
          username: stats.user.username,
          nickname: stats.user.nickname,
          avatarUrl: stats.user.avatarUrl,
          level: stats.user.level || 1,
          rating,
          xp,
          badge: this.getBadge(rating),
          hasPremium,
        },
        wins: stats.wins,
        losses: stats.losses,
        draws: 0,
        totalMatches: stats.matches,
        // Винрейт показываем только если матчей >= 100 для периода "all", для weekly/monthly показываем всегда если есть матчи
        winRate: isAllPeriod ? (stats.matches >= 100 ? winRate : null) : (stats.matches > 0 ? winRate : null),
        ratingChange,
      };
    }));

    // Сортируем
    if (sortBy === 'xp') {
      entries.sort((a, b) => (b.user?.xp || 0) - (a.user?.xp || 0));
    } else if (sortBy === 'matches') {
      entries.sort((a, b) => b.totalMatches - a.totalMatches);
    } else if (sortBy === 'winrate') {
      const filteredEntries = entries.filter(entry => entry.totalMatches >= 100 && entry.winRate !== null);
      filteredEntries.sort((a, b) => {
        const aWinRate = a.winRate || 0;
        const bWinRate = b.winRate || 0;
        if (Math.abs(aWinRate - bWinRate) > 0.01) {
          return bWinRate - aWinRate;
        }
        return b.totalMatches - a.totalMatches;
      });
      entries.length = 0;
      entries.push(...filteredEntries);
    } else if (sortBy === 'rating') {
      if (isAllPeriod) {
        // Для периода "all" сортируем по текущему рейтингу
        entries.sort((a, b) => (b.user?.rating || 0) - (a.user?.rating || 0));
      } else {
        // Для других периодов сортируем по изменению рейтинга за период
        entries.sort((a, b) => (b.ratingChange || 0) - (a.ratingChange || 0));
      }
    }

    return entries.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  async getWeeklyLeaderboard(mode: GameMode, limit: number = 100): Promise<Rating[]> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return this.ratingsRepository
      .createQueryBuilder('rating')
      .where('rating.mode = :mode', { mode })
      .andWhere('rating.updatedAt >= :weekAgo', { weekAgo })
      .orderBy('rating.elo', 'DESC')
      .take(limit)
      .leftJoinAndSelect('rating.user', 'user')
      .getMany();
  }

  async getUserRank(userId: string, mode: GameMode): Promise<number> {
    const rating = await this.ratingsRepository.findOne({
      where: { userId, mode },
    });

    if (!rating) {
      return 0;
    }

    const rank = await this.ratingsRepository
      .createQueryBuilder('rating')
      .where('rating.mode = :mode', { mode })
      .andWhere('rating.elo > :elo', { elo: rating.elo })
      .getCount();

    return rank + 1;
  }

  getBadge(rating: number): string {
    if (rating >= 2000) return 'Мастер';
    if (rating >= 1800) return 'Эксперт';
    if (rating >= 1600) return 'Продвинутый';
    if (rating >= 1400) return 'Средний';
    if (rating >= 1200) return 'Начинающий';
    return 'Новичок';
  }

  async getMyStats(userId: string): Promise<any> {
    // Получаем рейтинги
    const shortRating = await this.getRating(userId, GameMode.SHORT) || 1000;
    const longRating = await this.getRating(userId, GameMode.LONG) || 1000;
    const overallRating = Math.round((shortRating + longRating) / 2);

    // Получаем все игры пользователя (только vs_player)
    const allGames = await this.gamesRepository
      .createQueryBuilder('game')
      .where('(game.player1Id = :userId OR game.player2Id = :userId)', { userId })
      .andWhere('game.type = :type', { type: GameType.VS_PLAYER })
      .andWhere('game.status = :status', { status: GameStatus.FINISHED })
      .getMany();

    const totalMatches = allGames.length;
    const wins = allGames.filter(g => g.winnerId === userId).length;
    const losses = totalMatches - wins;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100 * 10) / 10 : 0;

    // Получаем общий XP пользователя
    const rating = await this.ratingsRepository.findOne({
      where: { userId, mode: GameMode.SHORT },
      relations: ['user'],
    });
    const totalXP = rating?.user ? Number(rating.user.xp || 0) : 0;

    // Получаем рейтинг неделю назад для изменения
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    // Упрощенно - считаем изменение как разницу от базового рейтинга
    const ratingChange = overallRating - 1000; // Можно улучшить, сохраняя историю

    return {
      overallRating,
      shortRating,
      longRating,
      totalMatches,
      wins,
      losses,
      winRate,
      totalXP,
      ratingChange,
    };
  }
}

