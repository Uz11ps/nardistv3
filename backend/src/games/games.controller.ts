import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getGame(@Param('id') id: string) {
    return this.gamesService.getGameState(id);
  }

  @Post('create-bot')
  @UseGuards(JwtAuthGuard)
  async createBotGame(@CurrentUser() user: any) {
    return this.gamesService.createBotGame(user.id);
  }

  @Get(':id/possible-moves')
  @UseGuards(JwtAuthGuard)
  async getPossibleMoves(@CurrentUser() user: any, @Param('id') id: string) {
    return this.gamesService.getPossibleMoves(id, user.id);
  }
}

