import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './rating.entity';
import { GameMode } from '../games/game.entity';
import { SystemSettings } from '../admin/system-settings.entity';

@Injectable()
export class RatingsService {
  private readonly K_FACTOR = 32;

  constructor(
    @InjectRepository(Rating)
    private ratingsRepository: Repository<Rating>,
    @InjectRepository(SystemSettings)
    private systemSettingsRepository: Repository<SystemSettings>,
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
      
      // Нормализуем разницу рейтинга в диапазон [-500, 500] для расчета множителя
      // Максимальная разница 500 (из matchmaking)
      const normalizedDiff = Math.max(-500, Math.min(500, ratingDiff));
      const multiplier = normalizedDiff / 500; // От -1 до 1
      
      // Вычисляем изменение рейтинга для победителя
      // Если победитель сильнее (ratingDiff > 0, multiplier > 0), он получает меньше (25 - 10 = 15)
      // Если победитель слабее (ratingDiff < 0, multiplier < 0), он получает больше (25 + 10 = 35)
      // multiplier = ratingDiff / 500, поэтому:
      // - Если ratingDiff = 500 (победитель намного сильнее), multiplier = 1, получает 25 - 10 = 15
      // - Если ratingDiff = -500 (победитель намного слабее), multiplier = -1, получает 25 + 10 = 35
      // - Если ratingDiff = 0 (равные), multiplier = 0, получает 25
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
    let query = this.ratingsRepository
      .createQueryBuilder('rating')
      .where('rating.mode = :mode', { mode })
      .leftJoinAndSelect('rating.user', 'user');

    // Фильтрация по периоду - фильтруем по дате обновления рейтинга
    // Рейтинг обновляется при каждой игре, поэтому updatedAt отражает последнюю активность
    if (period === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.andWhere('rating.updatedAt >= :weekAgo', { weekAgo });
    } else if (period === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      query = query.andWhere('rating.updatedAt >= :monthAgo', { monthAgo });
    }

    // Получаем все записи без ограничения для правильной сортировки
    const ratings = await query.getMany();

    // Вычисляем значения для сортировки и форматируем ответ
    const entries = ratings.map((rating) => {
      const totalMatches = (rating.wins || 0) + (rating.losses || 0) + (rating.draws || 0);
      const winRate = totalMatches >= 100 && totalMatches > 0 
        ? Math.round(((rating.wins || 0) / totalMatches) * 100 * 10) / 10 
        : null;
      
      return {
        user: rating.user ? {
          id: rating.user.id,
          username: rating.user.username,
          nickname: rating.user.nickname,
          level: rating.user.level || 1,
          rating: rating.elo,
          xp: Number(rating.user.xp || 0),
          badge: this.getBadge(rating.elo),
        } : null,
        wins: rating.wins || 0,
        losses: rating.losses || 0,
        draws: rating.draws || 0,
        totalMatches,
        winRate,
      };
    });

    // Сортируем в памяти в зависимости от выбранного критерия
    if (sortBy === 'xp') {
      entries.sort((a, b) => (b.user?.xp || 0) - (a.user?.xp || 0));
    } else if (sortBy === 'matches') {
      entries.sort((a, b) => b.totalMatches - a.totalMatches);
    } else if (sortBy === 'winrate') {
      entries.sort((a, b) => {
        // Сначала по винрейту (только для игроков с 100+ матчами)
        const aWinRate = a.winRate !== null ? a.winRate : 0;
        const bWinRate = b.winRate !== null ? b.winRate : 0;
        if (Math.abs(aWinRate - bWinRate) > 0.01) {
          return bWinRate - aWinRate;
        }
        // Затем по количеству матчей
        return b.totalMatches - a.totalMatches;
      });
    } else {
      // По умолчанию сортируем по рейтингу
      entries.sort((a, b) => (b.user?.rating || 0) - (a.user?.rating || 0));
    }

    // Ограничиваем количество результатов и добавляем ранги
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
}

