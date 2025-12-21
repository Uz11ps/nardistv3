import { Controller, Get, Post, Body, Param, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GamesGateway } from './games.gateway';
import { MatchmakingService } from '../matchmaking/matchmaking.service';

@Controller('games')
export class GamesController {
  constructor(
    private readonly gamesService: GamesService,
    @Inject(forwardRef(() => GamesGateway))
    private readonly gamesGateway: GamesGateway,
    @Inject(forwardRef(() => MatchmakingService))
    private readonly matchmakingService: MatchmakingService,
  ) {}

  @Get('tables')
  @UseGuards(JwtAuthGuard)
  async getTables() {
    return this.matchmakingService.getOpenTables();
  }

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

  @Post(':id/resign')
  @UseGuards(JwtAuthGuard)
  async resignGame(@CurrentUser() user: any, @Param('id') id: string) {
    const game = await this.gamesService.resignGame(id, user.id);
    const gameState = await this.gamesService.getGameState(id);
    
    // Если игра была отменена (ABANDONED) - удаляем стол из Redis
    if (game.status === 'abandoned') {
      await this.matchmakingService.deleteTableFromRedis(id);
      // Обновляем список столов
      const tables = await this.matchmakingService.getOpenTables();
      this.gamesGateway.server.emit('open_tables', tables);
    } else if (game.status === 'finished') {
      // Если игра завершена - отправляем событие завершения
      this.gamesGateway.server.to(`game:${id}`).emit('game_finished', {
        winnerId: game.winnerId,
        player1Score: game.player1Score,
        player2Score: game.player2Score,
        gameState,
      });
    }
    
    return game;
  }
}
