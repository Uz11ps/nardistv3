import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAchievements(
    @CurrentUser() user: any,
    @Query('filter') filter?: string,
  ) {
    return this.achievementsService.getUserAchievements(user.id, filter);
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  async claimAchievement(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.achievementsService.claimAchievement(user.id, id);
    return { message: 'Награда получена' };
  }
}

