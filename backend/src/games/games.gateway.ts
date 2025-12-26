import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BotService } from '../bot/bot.service';
import { SkinsService } from '../skins/skins.service';
import { Inject, forwardRef, Logger, OnModuleDestroy } from '@nestjs/common';
import { GameType } from './game.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/games',
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GamesGateway.name);
  private connectedUsers = new Map<string, string>();
  private moveTimeoutCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private gamesService: GamesService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => BotService))
    private botService: BotService,
    private skinsService: SkinsService,
  ) {
    // Запускаем периодическую проверку таймаутов ходов каждые 10 секунд
    this.startMoveTimeoutChecker();
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      this.connectedUsers.set(client.id, payload.sub);
      client.data.userId = payload.sub;
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedUsers.delete(client.id);
  }

  /**
   * Запускает периодическую проверку таймаутов ходов в активных играх
   */
  private startMoveTimeoutChecker(): void {
    // Проверяем каждые 10 секунд
    this.moveTimeoutCheckInterval = setInterval(async () => {
      await this.checkMoveTimeouts();
      await this.sendTimerUpdates();
    }, 1000); // Обновляем таймер каждую секунду
  }

  /**
   * Отправляет обновление таймера для конкретной игры
   */
  private async sendTimerUpdateForGame(gameId: string): Promise<void> {
    try {
      const game = await this.gamesService.findOne(gameId);
      if (!game || game.status !== 'in_progress' || !game.lastMoveAt) {
        return;
      }

      const now = new Date();
      const timeSinceLastMove = Math.floor((now.getTime() - game.lastMoveAt.getTime()) / 1000);
      const normalTimeLimit = 30; // Обычное время 30 секунд
      const overtimeLimit = 60; // Овертайм 60 секунд
      const totalTimeLimit = normalTimeLimit + overtimeLimit; // Всего 90 секунд
      
      // Вычисляем оставшееся время (90 секунд максимум)
      const timeRemaining = Math.max(0, totalTimeLimit - timeSinceLastMove);
      
      // Отправляем таймер всем участникам игры
      this.server.to(`game:${gameId}`).emit('timer_update', {
        gameId: game.id,
        currentPlayer: game.currentPlayer,
        timeElapsed: timeSinceLastMove,
        timeRemaining: timeRemaining,
        isOvertime: timeSinceLastMove > normalTimeLimit,
      });
    } catch (error) {
      this.logger.error(`❌ Error sending timer update for game ${gameId}:`, error);
    }
  }

  /**
   * Отправляет обновления таймеров для всех активных игр
   */
  private async sendTimerUpdates(): Promise<void> {
    try {
      // Проверяем, что server инициализирован
      if (!this.server) {
        return;
      }

      const activeGames = await this.gamesService.getActiveInProgressGames();
      const now = new Date();

      for (const game of activeGames) {
        if (!game.lastMoveAt || !game.id) {
          continue;
        }

        try {
          // Убеждаемся, что lastMoveAt это Date объект
          const lastMoveAt = game.lastMoveAt instanceof Date ? game.lastMoveAt : new Date(game.lastMoveAt);
          const timeSinceLastMove = Math.floor((now.getTime() - lastMoveAt.getTime()) / 1000);
          const normalTimeLimit = 30; // Обычное время 30 секунд
          const overtimeLimit = 60; // Овертайм 60 секунд
          const totalTimeLimit = normalTimeLimit + overtimeLimit; // Всего 90 секунд
          
          // Вычисляем оставшееся время (90 секунд максимум)
          const timeRemaining = Math.max(0, totalTimeLimit - timeSinceLastMove);
          
          // Отправляем таймер всем участникам игры
          this.server.to(`game:${game.id}`).emit('timer_update', {
            gameId: game.id,
            currentPlayer: game.currentPlayer,
            timeElapsed: timeSinceLastMove,
            timeRemaining: timeRemaining,
            isOvertime: timeSinceLastMove > normalTimeLimit,
          });
        } catch (gameError) {
          this.logger.warn(`Error sending timer update for game ${game.id}:`, gameError);
          // Продолжаем с другими играми
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error sending timer updates:`, error instanceof Error ? error.message : error);
      this.logger.debug(`Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    }
  }

  /**
   * Проверяет все активные игры на таймауты ходов
   */
  private async checkMoveTimeouts(): Promise<void> {
    try {
      // Используем метод из GamesService для получения активных игр
      const activeGames = await this.gamesService.getActiveInProgressGames();

      const now = new Date();
      // Используем moveTimeLimit из каждой игры индивидуально

      for (const game of activeGames) {
        // Пропускаем игры с ботом (бот не должен таймаутить)
        if (game.type === GameType.VS_BOT && game.player2Id === null) {
          continue;
        }

        // Проверяем только игры где кубики уже брошены (есть lastMoveAt)
        if (!game.lastMoveAt) {
          continue;
        }

        // Проверяем что кубики брошены (dice не пустой)
        if (!game.gameState?.dice || game.gameState.dice.length === 0) {
          continue;
        }

        const timeSinceLastMove = now.getTime() - game.lastMoveAt.getTime();
        const normalTimeLimit = 30000; // 30 секунд обычное время
        const overtimeLimit = 60000; // 60 секунд овертайм
        const totalTimeLimit = normalTimeLimit + overtimeLimit; // Всего 90 секунд

        // Если прошло больше времени на ход (90 секунд), завершаем игру в пользу противника
        if (timeSinceLastMove > totalTimeLimit) {
          this.logger.warn(`⏱️ Move timeout detected for game ${game.id}, currentPlayer: ${game.currentPlayer}`);
          
          try {
            // Определяем игрока, который должен был сделать ход
            const timeoutPlayerId = game.currentPlayer === 0 ? game.player1Id : game.player2Id;
            
            // Проверяем что игра еще активна (могла завершиться между проверками)
            const currentGame = await this.gamesService.findOne(game.id);
            if (currentGame.status === 'finished') {
              continue;
            }
            
            // Автоматически сдаем игру от его имени (победит противник)
            await this.gamesService.resignGame(game.id, timeoutPlayerId);
            
            const gameState = await this.gamesService.getGameState(game.id);
            const finishedGame = await this.gamesService.findOne(game.id);
            
            // Уведомляем всех участников игры
            this.server.to(`game:${game.id}`).emit('game_finished', {
              winnerId: finishedGame.winnerId,
              player1Score: finishedGame.player1Score,
              player2Score: finishedGame.player2Score,
              gameState,
              reason: 'move_timeout',
            });
            
            this.logger.log(`✅ Game ${game.id} finished due to move timeout, winner: ${finishedGame.winnerId}`);
          } catch (error) {
            // Если игра уже завершена, игнорируем ошибку
            if (error.message && error.message.includes('уже завершена')) {
              continue;
            }
            this.logger.error(`❌ Error handling move timeout for game ${game.id}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error checking move timeouts:`, error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        this.logger.debug(`Error stack:`, error.stack);
      }
    }
  }

  /**
   * Останавливает проверку таймаутов (например, при остановке сервера)
   */
  onModuleDestroy(): void {
    if (this.moveTimeoutCheckInterval) {
      clearInterval(this.moveTimeoutCheckInterval);
    }
  }

  @SubscribeMessage('join_game')
  async handleJoinGame(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    const userId = client.data.userId;
    const game = await this.gamesService.findOne(data.gameId);

    if (game.player1Id !== userId && game.player2Id !== userId) {
      client.emit('error', { message: 'Вы не участник этой игры' });
      return;
    }

    client.join(`game:${data.gameId}`);
    client.emit('game_state', await this.gamesService.getGameState(data.gameId));
  }

  @SubscribeMessage('roll_dice')
  async handleRollDice(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    const userId = client.data.userId;
    try {
      const dice = await this.gamesService.rollDice(data.gameId, userId);
      
      // Применяем износ к кубикам после броска (Equipment Spec v2.0 - PER_ROLL)
      try {
        // Применяем износ к обоим кубикам (DIE_1 и DIE_2)
        // Если дубль, все равно применяем к обоим кубикам (каждый кубик изнашивается отдельно)
        // Применяем износ к обоим кубикам (Equipment Spec v2.0 - PER_ROLL)
        await this.skinsService.applyWearToDieAfterRoll(userId, 'DIE_1');
        await this.skinsService.applyWearToDieAfterRoll(userId, 'DIE_2');
      } catch (error) {
        this.logger.error(`Ошибка при применении износа к кубикам: ${error.message}`);
      }
      
      let gameState = await this.gamesService.getGameState(data.gameId);
      this.server.to(`game:${data.gameId}`).emit('dice_rolled', { dice, playerId: userId });
      
      // Проверяем наличие ходов после броска
      const possibleMoves = await this.gamesService.getPossibleMoves(data.gameId, userId);
      const hasMoves = possibleMoves.allMoves.length > 0 && possibleMoves.allMoves.some(seq => seq.length > 0);
      
      if (!hasMoves) {
        this.logger.log(`🔄 No possible moves for user ${userId}, switching turn automatically`);
        // Переключаем ход сразу без задержки
        try {
          await this.gamesService.makeMove(data.gameId, userId, []);
          const updatedGameState = await this.gamesService.getGameState(data.gameId);
          this.server.to(`game:${data.gameId}`).emit('game_state', updatedGameState);
          await this.sendTimerUpdateForGame(data.gameId);
          
          // Если после переключения должен ходить бот
          await this.handleBotTurnIfNeeded(data.gameId);
        } catch (e) {
          this.logger.error(`Error in auto-skip turn: ${e.message}`);
        }
      } else {
        this.server.to(`game:${data.gameId}`).emit('game_state', gameState);
        // Отправляем обновление таймера сразу после броска кубиков
        await this.sendTimerUpdateForGame(data.gameId);
      }
    } catch (error) {
      this.logger.error(`❌ Error in roll_dice: ${error.message}`);
      client.emit('error', { message: error.message || 'Ошибка броска кубиков' });
    }
  }

  @SubscribeMessage('make_move')
  async handleMakeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; moves: Array<{ from: number; to: number; die: number }> },
  ) {
    const userId = client.data.userId;
    this.logger.log(`🎮 make_move received: gameId=${data.gameId}, userId=${userId}, moves count=${data.moves?.length || 0}`);
    
    if (!data.gameId) {
      this.logger.error(`❌ make_move: gameId is missing! data:`, JSON.stringify(data));
      client.emit('error', { message: 'ID игры не указан' });
      return;
    }
    
    try {
      this.logger.log(`✅ Calling gamesService.makeMove with gameId=${data.gameId}, userId=${userId}`);
      const game = await this.gamesService.makeMove(data.gameId, userId, data.moves);
      this.logger.log(`✅ Move completed successfully, getting game state for gameId=${data.gameId}`);
      const gameState = await this.gamesService.getGameState(data.gameId);
      this.logger.log(`✅ Emitting move_made event for gameId=${data.gameId}`);
      this.server.to(`game:${data.gameId}`).emit('move_made', gameState);
      // Также отправляем game_state для гарантированного обновления доски
      this.server.to(`game:${data.gameId}`).emit('game_state', gameState);
      
      // Отправляем обновление таймера сразу после хода
      await this.sendTimerUpdateForGame(data.gameId);
      
      if (game.status === 'finished') {
        this.logger.log(`🏁 Game finished, emitting game_finished for gameId=${data.gameId}`);
        this.server.to(`game:${data.gameId}`).emit('game_finished', {
          winnerId: game.winnerId,
          player1Score: game.player1Score,
          player2Score: game.player2Score,
          gameState,
        });
      } else {
        // Check if next player is bot and trigger bot move
        this.logger.log(`🤖 Checking if bot turn needed for gameId=${data.gameId}`);
        // Проверяем бота сразу без задержки
        await this.handleBotTurnIfNeeded(data.gameId);
      }
    } catch (error) {
      this.logger.error(`❌ Error in make_move:`, error);
      this.logger.error(`❌ Error details: message=${error.message}, stack=${error.stack}`);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Handle bot turn if next player is bot
   */
  async handleBotTurnIfNeeded(gameId: string): Promise<void> {
    try {
      const game = await this.gamesService.findOne(gameId);
      
      // Check if it's a bot game and bot's turn
      if (game.type === 'vs_bot' && game.player2Id === null && game.currentPlayer === 1 && game.status === 'in_progress') {
        const botPlayerId = null; // Use null for bot
        
        // Roll dice for bot
        const botDice = await this.gamesService.rollDice(gameId, botPlayerId);
        
        // Применяем износ к кубикам бота после броска (Equipment Spec v2.0 - PER_ROLL)
        // Бот-игры обычно не тратят износ, но для консистентности можно оставить
        // TODO: Решить, нужно ли применять износ для бот-игр
        
        const gameStateAfterDice = await this.gamesService.getGameState(gameId);
        
        // Emit dice rolled event
        this.server.to(`game:${gameId}`).emit('dice_rolled', { 
          dice: botDice, 
          playerId: null 
        });
        this.server.to(`game:${gameId}`).emit('game_state', gameStateAfterDice);
        
        // Делаем ход бота сразу без задержки
        try {
          const updatedGame = await this.gamesService.findOne(gameId);
          if (updatedGame.status === 'finished') return;
          
          if (!updatedGame.id) {
            this.logger.error(`❌ Bot move: updatedGame.id is missing! gameId=${gameId}`);
            return;
          }
          
          this.logger.log(`🤖 Making bot move for gameId=${gameId}, updatedGame.id=${updatedGame.id}`);
            const botMoves = await this.botService.makeBotMove(updatedGame.gameState, updatedGame.mode);
            
            // Всегда вызываем makeMove, даже если ходов 0, чтобы сработала логика переключения хода
            this.logger.log(`🤖 Bot moves: ${botMoves.length} moves, calling makeMove with gameId=${gameId}`);
            const botMoveResult = await this.gamesService.makeMove(gameId, botPlayerId, botMoves);
            const gameStateAfterMove = await this.gamesService.getGameState(gameId);
            
            // Emit move_made event (или просто game_state если ходов не было)
            if (botMoves.length > 0) {
              this.server.to(`game:${gameId}`).emit('move_made', gameStateAfterMove);
              // Также отправляем game_state для гарантированного обновления доски
              this.server.to(`game:${gameId}`).emit('game_state', gameStateAfterMove);
            } else {
              this.server.to(`game:${gameId}`).emit('game_state', gameStateAfterMove);
            }
            
            // Check if game finished
            if (botMoveResult.status === 'finished') {
              this.server.to(`game:${gameId}`).emit('game_finished', {
                winnerId: botMoveResult.winnerId,
                player1Score: botMoveResult.player1Score,
                player2Score: botMoveResult.player2Score,
                gameState: gameStateAfterMove,
              });
            } else {
              // After bot move, check if it's still bot's turn or player's turn
              const finalGame = await this.gamesService.findOne(gameId);
              if (finalGame.status === 'finished') return;
              
              if (finalGame.currentPlayer === 0) {
                this.logger.log(`👤 Player's turn after bot move, emitting game_state for gameId=${gameId}`);
                const playerGameState = await this.gamesService.getGameState(gameId);
                this.server.to(`game:${gameId}`).emit('game_state', playerGameState);
              } else {
                // Если все еще ход бота (например, в длинных нардах не все кубики использованы),
                // но ходов больше нет - makeMove уже должен был переключить ход.
                // Если не переключил - значит бот должен ходить дальше.
                this.logger.log(`🤖 Still bot's turn, recursively calling handleBotTurnIfNeeded for gameId=${gameId}`);
                await this.handleBotTurnIfNeeded(gameId);
              }
            }
          } catch (error) {
            console.error(`Bot move error: ${error.message}`, error.stack);
          }
        }, 1500);
      }
    } catch (error) {
      console.error(`Bot turn check error: ${error.message}`, error.stack);
    }
  }
}

