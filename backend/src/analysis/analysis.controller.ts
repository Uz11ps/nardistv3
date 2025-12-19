import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get('game/:gameId')
  @UseGuards(JwtAuthGuard)
  async analyzeGame(@CurrentUser() user: any, @Param('gameId') gameId: string) {
    return this.analysisService.analyzeGame(user.id, gameId);
  }
}

