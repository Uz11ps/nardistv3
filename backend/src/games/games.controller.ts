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

  @Get('active')
  @UseGuards(JwtAuthGuard)
  async getActiveGame(@CurrentUser() user: any) {
    try {
      const game = await this.gamesService.getActiveGame(user.id);
      if (!game) {
        return { game: null };
      }
      // Возвращаем только необходимые поля, чтобы избежать проблем с сериализацией
      return {
        game: {
          id: game.id,
          status: game.status,
          mode: game.mode,
          type: game.type,
          player1Id: game.player1Id,
          player2Id: game.player2Id,
          currentPlayer: game.currentPlayer,
        },
      };
    } catch (error) {
      // Логируем ошибку, но возвращаем null вместо ошибки 500
      console.error('Ошибка при получении активной игры:', error);
      return { game: null };
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getGame(@Param('id') id: string) {
    return this.gamesService.getGameState(id);
  }

  @Get(':id/skins')
  @UseGuards(JwtAuthGuard)
  async getGameSkins(@Param('id') id: string) {
    return this.gamesService.getGameSkins(id);
  }

  @Post('create-bot')
  @UseGuards(JwtAuthGuard)
  async createBotGame(@CurrentUser() user: any, @Body() body?: { mode?: string }) {
    try {
      console.log('🎮 create-bot вызван:', { userId: user?.id, userType: typeof user, userKeys: user ? Object.keys(user) : 'null' });
      if (!user || !user.id) {
        console.error('❌ Пользователь не найден в токене:', user);
        throw new Error('Пользователь не найден в токене');
      }
      const mode = body?.mode === 'short' ? 'short' : 'long';
      return await this.gamesService.createBotGame(user.id, mode as any);
    } catch (error) {
      console.error('❌ Ошибка при создании игры с ботом:', error);
      throw error;
    }
  }

  @Post('create-ai')
  @UseGuards(JwtAuthGuard)
  async createAIGame(@CurrentUser() user: any, @Body() body?: { mode?: string }) {
    // Отдельный endpoint для игры с ИИ (алиас для create-bot)
    const mode = body?.mode === 'short' ? 'short' : 'long';
    return this.gamesService.createBotGame(user.id, mode as any);
  }

  @Get(':id/possible-moves')
  @UseGuards(JwtAuthGuard)
  async getPossibleMoves(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body?: { fromPoint?: number },
  ) {
    return this.gamesService.getPossibleMoves(id, user.id, body?.fromPoint);
  }

  @Get(':id/possible-moves/:fromPoint')
  @UseGuards(JwtAuthGuard)
  async getPossibleMovesFromPoint(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('fromPoint') fromPoint: string,
  ) {
    const from = parseInt(fromPoint, 10);
    return this.gamesService.getPossibleMoves(id, user.id, from);
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
