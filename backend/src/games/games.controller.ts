import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GamesGateway } from './games.gateway';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { GameStatus, GameType } from './game.entity';

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
      // Сначала проверяем через getActiveGame (исключает бот-игры)
      let game = await this.gamesService.getActiveGame(user.id);
      
      // Если не найдено, проверяем все активные игры игрока (включая бот-игры, исключая sandbox)
      if (!game) {
        const allActiveGames = await this.gamesService.getActiveGamesByPlayer(user.id);
        // Фильтруем sandbox игры и берем первую активную игру (приоритет: in_progress > waiting)
        const nonSandboxGames = allActiveGames.filter(g => g.type !== GameType.SANDBOX);
        const inProgressGame = nonSandboxGames.find(g => g.status === GameStatus.IN_PROGRESS);
        game = inProgressGame || nonSandboxGames.find(g => g.status === GameStatus.WAITING) || null;
      }
      
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

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard)
  async getGameAnalytics(@Param('id') id: string) {
    return this.gamesService.getGameAnalytics(id);
  }

  @Get('statistics/me')
  @UseGuards(JwtAuthGuard)
  async getMyStatistics(@CurrentUser() user: any) {
    return this.gamesService.getPlayerStatistics(user.id);
  }

  @Get('statistics/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserStatistics(@Param('userId') userId: string) {
    return this.gamesService.getPlayerStatistics(userId);
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
      console.log('🎮 create-bot вызван:', { 
        userId: user?.id, 
        userType: typeof user, 
        userKeys: user ? Object.keys(user) : 'null',
        userFull: JSON.stringify(user, null, 2)
      });
      
      if (!user) {
        console.error('❌ Пользователь не найден в токене (user is null/undefined)');
        throw new Error('Пользователь не найден в токене. Возможно, токен недействителен или пользователь был удален.');
      }
      
      if (!user.id) {
        console.error('❌ Пользователь не имеет ID:', user);
        throw new Error('Пользователь не имеет ID. Возможно, проблема с валидацией токена.');
      }
      
      const mode = body?.mode === 'short' ? 'short' : 'long';
      console.log('🎮 Создание игры с ботом:', { userId: user.id, mode });
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

  @Post('create-sandbox')
  @UseGuards(JwtAuthGuard)
  async createSandboxGame(@CurrentUser() user: any, @Body() body?: { mode?: string }) {
    try {
      const mode = body?.mode === 'short' ? 'short' : 'long';
      console.log('🎮 Создание песочницы:', { userId: user.id, mode });
      return await this.gamesService.createSandboxGame(user.id, mode as any);
    } catch (error) {
      console.error('❌ Ошибка при создании песочницы:', error);
      throw error;
    }
  }

  @Get(':id/moves')
  @UseGuards(JwtAuthGuard)
  async getGameMoves(@Param('id') id: string) {
    return this.gamesService.getMoves(id);
  }

  @Get(':id/verify-rolls')
  @UseGuards(JwtAuthGuard)
  async verifyGameRolls(@Param('id') id: string) {
    return this.gamesService.verifyGameRolls(id);
  }

  @Post(':id/possible-moves')
  @UseGuards(JwtAuthGuard)
  async getPossibleMoves(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body?: { pendingMoves?: Array<{ from: number; to: number; die: number }> },
  ) {
    return this.gamesService.getPossibleMoves(id, user.id, body?.pendingMoves);
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
        game: {
          player1Wins: game.player1Wins || 0,
          player2Wins: game.player2Wins || 0,
          matchesToWin: game.matchesToWin || 1,
        },
      });
    }
    
    return game;
  }

  @Post(':id/offset')
  @UseGuards(JwtAuthGuard)
  async setOffset(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { offset: number },
  ) {
    const game = await this.gamesService.setOffset(id, user.id, body.offset);
    
    // ВАЖНО: Отправляем обновленное состояние игры через WebSocket
    // Это нужно для обновления доски после выбора смещения
    const gameState = await this.gamesService.getGameState(id);
    this.gamesGateway.server.to(`game:${id}`).emit('game_state', gameState);
    
    // Также отправляем событие offset_updated для обновления смещений
    this.gamesGateway.server.to(`game:${id}`).emit('offset_updated', {
      player1Offset: game.p1Offset,
      player2Offset: game.p2Offset,
      p1OffsetChosenAt: game.p1OffsetChosenAt,
      p2OffsetChosenAt: game.p2OffsetChosenAt,
    });
    
    // Оповещаем второго игрока об изменении смещения через WebSocket
    this.gamesGateway.server.to(`game:${id}`).emit('offset_updated', {
      player1Offset: game.p1Offset,
      player2Offset: game.p2Offset,
    });
    
    // Если игра только что началась (оба выбрали смещение), отправляем обновленное состояние
    // Пропускаем для игр с ботом - там события отправляются через другие механизмы
    if (game.status === 'in_progress' && game.type !== 'vs_bot') {
      const updatedGame = await this.gamesService.findOne(id);
      const gameState = await this.gamesService.getGameState(id);
      
      // Отправляем обновленное состояние игры
      this.gamesGateway.server.to(`game:${id}`).emit('game_updated', gameState);
      
      // Если кубики уже брошены (игра началась), отправляем события dice_rolled и game_state
      if (updatedGame.gameState?.dice?.length > 0) {
        const eventId = `${id}_${Date.now()}_auto`;
        this.gamesGateway.server.to(`game:${id}`).emit('dice_rolled', { 
          dice: updatedGame.gameState.dice, 
          playerId: updatedGame.currentPlayer === 0 ? updatedGame.player1Id : updatedGame.player2Id,
          eventId 
        });
        this.gamesGateway.server.to(`game:${id}`).emit('game_state', gameState);
      }
    }
    
    return game;
  }

  @Post(':id/sandbox/setup-board')
  @UseGuards(JwtAuthGuard)
  async setupSandboxBoard(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { points: number[]; bar?: { white: number; black: number }; bearOff?: { white: number; black: number } },
  ) {
    return this.gamesService.setupSandboxBoard(id, user.id, body);
  }

  @Post(':id/sandbox/set-dice')
  @UseGuards(JwtAuthGuard)
  async setSandboxDice(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { dice: number[]; player?: number },
  ) {
    return this.gamesService.setSandboxDice(id, user.id, body.dice, body.player);
  }

  @Get('sandbox/chapters')
  @UseGuards(JwtAuthGuard)
  async getSandboxChapters(@CurrentUser() user: any) {
    return this.gamesService.getSandboxChapters(user.id);
  }

  @Post('sandbox/chapters')
  @UseGuards(JwtAuthGuard)
  async createSandboxChapter(
    @CurrentUser() user: any,
    @Body() body: { name: string; gameState: any },
  ) {
    return this.gamesService.createSandboxChapter(user.id, body.name, body.gameState);
  }

  @Patch('sandbox/chapters/:id')
  @UseGuards(JwtAuthGuard)
  async updateSandboxChapter(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { name?: string; gameState?: any },
  ) {
    return this.gamesService.updateSandboxChapter(id, user.id, body);
  }

  @Delete('sandbox/chapters/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSandboxChapter(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.gamesService.deleteSandboxChapter(id, user.id);
  }
}
