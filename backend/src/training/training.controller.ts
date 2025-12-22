import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TrainingService } from './training.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('positions')
  @UseGuards(JwtAuthGuard)
  async getPositions(@CurrentUser() user: any, @Query('difficulty') difficulty?: number) {
    return this.trainingService.getPositions(user?.id, difficulty ? parseInt(difficulty.toString()) : undefined);
  }

  @Get('positions/:id')
  @UseGuards(JwtAuthGuard)
  async getPosition(@CurrentUser() user: any, @Param('id') id: string) {
    return this.trainingService.getPosition(user.id, id);
  }

  @Post('positions/:id/check')
  @UseGuards(JwtAuthGuard)
  async checkSolution(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('move') move: Array<{ from: number; to: number; die: number }>,
  ) {
    return this.trainingService.checkSolution(user.id, id, move);
  }

  @Get('tasks')
  @UseGuards(JwtAuthGuard)
  async getTasks(@CurrentUser() user: any) {
    return this.trainingService.getTasks(user.id);
  }

  @Post('tasks/:id/claim')
  @UseGuards(JwtAuthGuard)
  async claimTaskReward(@CurrentUser() user: any, @Param('id') id: string) {
    await this.trainingService.claimTaskReward(user.id, id);
    return { message: 'Награда получена' };
  }
}

