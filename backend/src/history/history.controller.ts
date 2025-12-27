import { Controller, Get, Param, Query, UseGuards, Res } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Response } from 'express';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getHistory(@CurrentUser() user: any, @Query() filters: any) {
    return this.historyService.getUserGames(user.id, filters);
  }

  @Get('replay/:gameId')
  @UseGuards(JwtAuthGuard)
  async getReplay(
    @CurrentUser() user: any,
    @Param('gameId') gameId: string,
    @Query('step') step?: string,
  ) {
    // Проверяем, что пользователь имеет доступ к этой игре
    const replay = await this.historyService.getGameReplay(gameId, step ? parseInt(step, 10) : undefined);
    const game = replay.game;
    
    // Админы могут просматривать любую игру
    if (!user.isAdmin && game.player1Id !== user.id && game.player2Id !== user.id) {
      throw new Error('Нет доступа к этой игре');
    }
    
    // Проверяем, что игра завершена (для реплея нужна завершенная игра)
    if (game.status !== 'finished') {
      throw new Error('Реплей доступен только для завершенных игр');
    }
    
    return replay;
  }

  @Get('export/:gameId/json')
  @UseGuards(JwtAuthGuard)
  async exportJSON(@Param('gameId') gameId: string, @Res() res: Response) {
    const json = await this.historyService.exportGameJSON(gameId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="game_${gameId}.json"`);
    res.send(json);
  }

  @Get('export/:gameId/csv')
  @UseGuards(JwtAuthGuard)
  async exportCSV(@Param('gameId') gameId: string, @Res() res: Response) {
    const csv = await this.historyService.exportGameCSV(gameId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="game_${gameId}.csv"`);
    res.send(csv);
  }
}

