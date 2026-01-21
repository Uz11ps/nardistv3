import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './rating.entity';
import { GameMode } from '../games/game.entity';

@Injectable()
export class RatingsService {
  private readonly K_FACTOR = 32;

  constructor(
    @InjectRepository(Rating)
    private ratingsRepository: Repository<Rating>,
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

    const winnerExpected = this.calculateExpectedScore(winnerRating.elo, loserRating.elo);
    const loserExpected = this.calculateExpectedScore(loserRating.elo, winnerRating.elo);

    if (isDraw) {
      winnerRating.elo = Math.round(winnerRating.elo + this.K_FACTOR * (0.5 - winnerExpected));
      loserRating.elo = Math.round(loserRating.elo + this.K_FACTOR * (0.5 - loserExpected));
      winnerRating.draws++;
      loserRating.draws++;
    } else {
      winnerRating.elo = Math.round(winnerRating.elo + this.K_FACTOR * (1 - winnerExpected));
      loserRating.elo = Math.round(loserRating.elo + this.K_FACTOR * (0 - loserExpected));
      winnerRating.wins++;
      loserRating.losses++;
    }

    await this.ratingsRepository.save([winnerRating, loserRating]);
  }

  private calculateExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  async getLeaderboard(mode: GameMode, period: string = 'all', limit: number = 100): Promise<any[]> {
    let query = this.ratingsRepository
      .createQueryBuilder('rating')
      .where('rating.mode = :mode', { mode })
      .leftJoinAndSelect('rating.user', 'user')
      .orderBy('rating.elo', 'DESC')
      .take(limit);

    if (period === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.andWhere('rating.updatedAt >= :weekAgo', { weekAgo });
    } else if (period === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      query = query.andWhere('rating.updatedAt >= :monthAgo', { monthAgo });
    }

    const ratings = await query.getMany();

    // Форматируем ответ для фронтенда
    return ratings.map((rating, index) => {
      const totalMatches = (rating.wins || 0) + (rating.losses || 0) + (rating.draws || 0);
      const winRate = totalMatches >= 100 && totalMatches > 0 
        ? Math.round(((rating.wins || 0) / totalMatches) * 100 * 10) / 10 
        : null;
      
      return {
        rank: index + 1,
        user: rating.user ? {
          id: rating.user.id,
          username: rating.user.username,
          nickname: rating.user.nickname,
          level: rating.user.level || 1,
          rating: rating.elo,
          badge: this.getBadge(rating.elo),
        } : null,
        wins: rating.wins || 0,
        losses: rating.losses || 0,
        draws: rating.draws || 0,
        totalMatches,
        winRate,
      };
    });
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

