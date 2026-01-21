import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GameMode } from '../games/game.entity';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('leaderboard')
  async getLeaderboard(
    @Query('mode') mode: GameMode,
    @Query('period') period?: string,
    @Query('sortBy') sortBy?: 'xp' | 'matches' | 'winrate' | 'rating',
    @Query('limit') limit?: string,
  ) {
    return this.ratingsService.getLeaderboard(
      mode || GameMode.SHORT,
      period || 'all',
      sortBy || 'rating',
      limit ? parseInt(limit) : 100,
    );
  }

  @Get('leaderboard/weekly')
  async getWeeklyLeaderboard(@Query('mode') mode: GameMode, @Query('limit') limit: string) {
    return this.ratingsService.getWeeklyLeaderboard(mode || GameMode.SHORT, limit ? parseInt(limit) : 100);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyRatings(@CurrentUser() user: any) {
    const shortRating = await this.ratingsService.getRating(user.id, GameMode.SHORT);
    const longRating = await this.ratingsService.getRating(user.id, GameMode.LONG);
    
    const shortRatingValue = shortRating || 1000;
    const longRatingValue = longRating || 1000;
    
    return {
      short: shortRatingValue,
      long: longRatingValue,
      badges: {
        short: this.ratingsService.getBadge(shortRatingValue),
        long: this.ratingsService.getBadge(longRatingValue),
      },
    };
  }

  @Get('rank/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserRank(@Param('userId') userId: string, @Query('mode') mode: GameMode) {
    const rank = await this.ratingsService.getUserRank(userId, mode || GameMode.SHORT);
    return { rank };
  }

  @Get('my-stats')
  @UseGuards(JwtAuthGuard)
  async getMyStats(@CurrentUser() user: any) {
    return this.ratingsService.getMyStats(user.id);
  }
}

