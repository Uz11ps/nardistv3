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
import { GameType, GameMode } from './game.entity';

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
  // Храним информацию об играх, ожидающих завершения анимации перед броском кубиков
  private pendingDiceRolls = new Map<string, { nextPlayerId: string | null; isBotTurn: boolean; gameId: string }>();

  constructor(
    @Inject(forwardRef(() => GamesService))
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

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    this.connectedUsers.delete(client.id);
    
    // ВАЖНО: НЕ проверяем таймауты при дисконнекте
    // Игрок может просто обновить страницу или потерять соединение
    // Таймауты проверяются только через checkMoveTimeouts() каждую секунду
    // Это предотвращает преждевременное завершение игры при обновлении страницы
    // Игра завершается только когда действительно истекло время (основное + овертайм)
    if (userId) {
      this.logger.log(`Player ${userId} disconnected, skipping timeout check (will be handled by checkMoveTimeouts)`);
    }
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
      if (!game || game.status !== 'in_progress') {
        return;
      }

      const now = new Date();
      // ВАЖНО: Если lastMoveAt не установлен, время еще не началось
      // Отправляем полное время без отсчета, чтобы фронтенд не показывал овертайм
      if (!game.lastMoveAt) {
        const currentPlayerTimeRemaining = game.currentPlayer === 0 
          ? (game.player1TimeRemaining || 60000) 
          : (game.player2TimeRemaining || 60000);
        
        this.server.to(`game:${gameId}`).emit('timer_update', {
          gameId: game.id,
          currentPlayer: game.currentPlayer,
          moveTimeRemaining: 15, // Полные 15 секунд
          totalTimeRemaining: currentPlayerTimeRemaining / 1000,
          isOvertime: false,
          player1TimeRemaining: game.player1TimeRemaining ? game.player1TimeRemaining / 1000 : 60,
          player2TimeRemaining: game.player2TimeRemaining ? game.player2TimeRemaining / 1000 : 60,
        });
        return;
      }
      const referenceTime = game.lastMoveAt instanceof Date ? game.lastMoveAt : new Date(game.lastMoveAt);
      const timeSinceLastMove = Math.max(0, (now.getTime() - referenceTime.getTime()) / 1000); // в секундах, не меньше 0
      const baseMoveTime = 15; // 15 секунд на ход (было 20)
      
      // Получаем общее время текущего игрока
      const currentPlayerTimeRemaining = game.currentPlayer === 0 
        ? (game.player1TimeRemaining || 60000) 
        : (game.player2TimeRemaining || 60000);
      
      // Вычисляем превышение 15 секунд
      const excessTime = Math.max(0, timeSinceLastMove - baseMoveTime);
      
      // Оставшееся время на ход: если прошло <= 15 сек, показываем оставшиеся 15 сек, иначе показываем общее время
      // ВАЖНО: Если timeSinceLastMove очень маленький (только что установлен lastMoveAt), показываем полные 15 секунд
      const moveTimeRemaining = timeSinceLastMove <= baseMoveTime 
        ? Math.max(0, baseMoveTime - timeSinceLastMove)
        : 0;
      
      // Общее время игрока после вычета превышения
      // ВАЖНО: Если timeSinceLastMove очень маленький, excessTime будет 0, и totalTimeRemaining будет полным
      const totalTimeRemaining = Math.max(0, (currentPlayerTimeRemaining / 1000) - excessTime);
      
      // ВАЖНО: Овертайм определяется как:
      // 1. Прошло больше 15 секунд на ход (timeSinceLastMove > baseMoveTime) И
      // 2. Общее время игрока <= 0 (totalTimeRemaining <= 0)
      // Это означает, что игрок использует овертайм (1 минута общего времени)
      // ВАЖНО: Если timeSinceLastMove очень маленький (только что установлен), isOvertime всегда false
      // ВАЖНО: Также проверяем, что moveTimeRemaining < 15 (если еще есть время на ход, овертайма нет)
      const isOvertime = timeSinceLastMove > baseMoveTime && 
                         totalTimeRemaining <= 0 && 
                         moveTimeRemaining < 15 &&
                         timeSinceLastMove > 1000; // Дополнительная защита: минимум 1 секунда должна пройти
      
      // Отправляем таймер всем участникам игры
      this.server.to(`game:${gameId}`).emit('timer_update', {
        gameId: game.id,
        currentPlayer: game.currentPlayer,
        moveTimeElapsed: timeSinceLastMove,
        moveTimeRemaining: moveTimeRemaining,
        totalTimeRemaining: totalTimeRemaining,
        isOvertime: isOvertime,
        player1TimeRemaining: game.player1TimeRemaining ? game.player1TimeRemaining / 1000 : 60,
        player2TimeRemaining: game.player2TimeRemaining ? game.player2TimeRemaining / 1000 : 60,
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
        if (!game.id) {
          continue;
        }

        try {
          // ВАЖНО: Используем lastMoveAt только если он установлен (после первого хода)
          // Если lastMoveAt не установлен, время еще не должно отсчитываться
          if (!game.lastMoveAt) {
            // Время еще не началось - игрок еще не сделал первый ход
            // Отправляем полное время без отсчета
            const currentPlayerTimeRemaining = game.currentPlayer === 0 
              ? (game.player1TimeRemaining || 60000) 
              : (game.player2TimeRemaining || 60000);
            
            this.server.to(game.id).emit('timer_update', {
              gameId: game.id,
              moveTimeRemaining: 15, // Полные 15 секунд
              totalTimeRemaining: currentPlayerTimeRemaining / 1000,
              isOvertime: false,
            });
            continue;
          }
          
          const referenceTime = game.lastMoveAt instanceof Date ? game.lastMoveAt : new Date(game.lastMoveAt);
          const timeSinceLastMove = (now.getTime() - referenceTime.getTime()) / 1000; // в секундах
          const baseMoveTime = 15; // 15 секунд на ход (было 20)
          
          // Получаем общее время текущего игрока
          const currentPlayerTimeRemaining = game.currentPlayer === 0 
            ? (game.player1TimeRemaining || 60000) 
            : (game.player2TimeRemaining || 60000);
          
          // Вычисляем превышение 15 секунд
          const excessTime = Math.max(0, timeSinceLastMove - baseMoveTime);
          
          // Оставшееся время на ход: если прошло <= 15 сек, показываем оставшиеся 15 сек, иначе показываем общее время
          const moveTimeRemaining = timeSinceLastMove <= baseMoveTime 
            ? baseMoveTime - timeSinceLastMove 
            : 0;
          
          // Общее время игрока после вычета превышения
          const totalTimeRemaining = Math.max(0, (currentPlayerTimeRemaining / 1000) - excessTime);
          
          // ВАЖНО: Овертайм определяется как:
          // 1. Прошло больше 15 секунд на ход (timeSinceLastMove > baseMoveTime) И
          // 2. Общее время игрока <= 0 (totalTimeRemaining <= 0)
          // Это означает, что игрок использует овертайм (1 минута общего времени)
          const isOvertime = timeSinceLastMove > baseMoveTime && totalTimeRemaining <= 0;
          
          // Отправляем таймер всем участникам игры
          this.server.to(`game:${game.id}`).emit('timer_update', {
            gameId: game.id,
            currentPlayer: game.currentPlayer,
            moveTimeElapsed: timeSinceLastMove,
            moveTimeRemaining: moveTimeRemaining,
            totalTimeRemaining: totalTimeRemaining,
            isOvertime: isOvertime,
            player1TimeRemaining: game.player1TimeRemaining ? game.player1TimeRemaining / 1000 : 60,
            player2TimeRemaining: game.player2TimeRemaining ? game.player2TimeRemaining / 1000 : 60,
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
   * Проверяет таймауты для всех активных игр конкретного игрока
   */
  private async checkPlayerGameTimeouts(playerId: string): Promise<void> {
    try {
      const activeGames = await this.gamesService.getActiveGamesByPlayer(playerId);
      if (activeGames.length === 0) {
        return;
      }

      const now = new Date();
      
      for (const game of activeGames) {
        try {
          // Проверяем, что игра еще активна
          const currentGame = await this.gamesService.findOne(game.id);
          if (currentGame.status !== 'in_progress') {
            continue;
          }

          // ВАЖНО: Если lastMoveAt не установлен, время еще не началось
          if (!currentGame.lastMoveAt) {
            // Время еще не началось - отправляем полное время через server
            const currentPlayerTimeRemaining = currentGame.currentPlayer === 0 
              ? (currentGame.player1TimeRemaining || 60000) 
              : (currentGame.player2TimeRemaining || 60000);
            
            if (this.server) {
              this.server.to(`game:${currentGame.id}`).emit('timer_update', {
                gameId: currentGame.id,
                moveTimeRemaining: 15,
                totalTimeRemaining: currentPlayerTimeRemaining / 1000,
                isOvertime: false,
              });
            }
            continue;
          }
          
          const referenceTime = currentGame.lastMoveAt instanceof Date ? currentGame.lastMoveAt : new Date(currentGame.lastMoveAt);
          
          const timeSinceLastMove = now.getTime() - referenceTime.getTime();
          const timeSinceLastMoveSeconds = timeSinceLastMove / 1000;
          
          // Определяем, является ли этот игрок текущим
          const isCurrentPlayer = (currentGame.currentPlayer === 0 && currentGame.player1Id === playerId) ||
                                  (currentGame.currentPlayer === 1 && currentGame.player2Id === playerId);
          
          if (!isCurrentPlayer) {
            continue; // Не ход этого игрока, пропускаем
          }

          // Для игр с ботами - проверяем 15 секунд на ход + овертайм (общее время игрока)
          if (currentGame.type === GameType.VS_BOT && currentGame.player2Id === null) {
            // ВАЖНО: Проверяем не только время на ход, но и общее время (овертайм)
            // Игра завершается только если: прошло > 15 сек И общее время <= 0
            const baseMoveTime = 15;
            const currentPlayerTimeRemaining = currentGame.currentPlayer === 0 
              ? (currentGame.player1TimeRemaining || 60000) 
              : (currentGame.player2TimeRemaining || 60000);
            
            const excessTime = Math.max(0, timeSinceLastMoveSeconds - baseMoveTime);
            const timeAfterBaseMove = Math.max(0, currentPlayerTimeRemaining - (excessTime * 1000));
            
            const isTimeOut = timeSinceLastMoveSeconds > baseMoveTime && timeAfterBaseMove <= 0;
            
            if (isTimeOut && currentGame.currentPlayer === 0) {
              this.logger.warn(`⏱️ Bot game timeout on disconnect for game ${currentGame.id}, player ${playerId} disconnected, timeSinceLastMove: ${timeSinceLastMoveSeconds.toFixed(2)}s, timeRemaining: ${(currentPlayerTimeRemaining / 1000).toFixed(2)}s`);
              
              await this.gamesService.resignGame(currentGame.id, playerId);
              const gameState = await this.gamesService.getGameState(currentGame.id);
              const finishedGame = await this.gamesService.findOne(currentGame.id);
              
              this.server.to(`game:${currentGame.id}`).emit('game_finished', {
                winnerId: finishedGame.winnerId,
                player1Score: finishedGame.player1Score,
                player2Score: finishedGame.player2Score,
                gameState,
                reason: 'timeout',
                game: {
                  player1Wins: finishedGame.player1Wins || 0,
                  player2Wins: finishedGame.player2Wins || 0,
                  matchesToWin: finishedGame.matchesToWin || 1,
                },
              });
              
              this.logger.log(`✅ Bot game ${currentGame.id} finished due to timeout on disconnect, bot won`);
            }
            continue;
          }

          // Для обычных игр - проверяем систему контроля времени
          const currentPlayerTimeRemaining = currentGame.currentPlayer === 0 
            ? (currentGame.player1TimeRemaining || 60000) 
            : (currentGame.player2TimeRemaining || 60000);
          
          const baseMoveTime = 15; // 15 секунд (было 20)
          const excessTime = Math.max(0, timeSinceLastMoveSeconds - baseMoveTime);
          const timeAfterBaseMove = Math.max(0, currentPlayerTimeRemaining - (excessTime * 1000));
          
          const isTimeOut = timeSinceLastMoveSeconds > baseMoveTime && timeAfterBaseMove <= 0;
          
          if (isTimeOut) {
            this.logger.warn(`⏱️ Time control timeout on disconnect for game ${currentGame.id}, player ${playerId} disconnected, timeSinceLastMove: ${timeSinceLastMoveSeconds.toFixed(2)}s`);
            
            // Обновляем общее время игрока
            await this.gamesService.updatePlayerTotalTime(currentGame.id, currentGame.currentPlayer, 0);
            
            await this.gamesService.resignGame(currentGame.id, playerId);
            const gameState = await this.gamesService.getGameState(currentGame.id);
            const finishedGame = await this.gamesService.findOne(currentGame.id);
            
            this.server.to(`game:${currentGame.id}`).emit('game_finished', {
              winnerId: finishedGame.winnerId,
              player1Score: finishedGame.player1Score,
              player2Score: finishedGame.player2Score,
              gameState,
              reason: 'timeout',
            });
            
            this.logger.log(`✅ Game ${currentGame.id} finished due to time control timeout on disconnect, winner: ${finishedGame.winnerId}`);
          }
        } catch (error) {
          if (error.message && error.message.includes('уже завершена')) {
            continue;
          }
          this.logger.error(`❌ Error handling timeout for game ${game.id} on disconnect:`, error);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error checking player game timeouts for ${playerId}:`, error);
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
        // Пропускаем свободный стол - там нет таймаутов
        if (game.type === GameType.SANDBOX) {
          continue;
        }

        // ВАЖНО: Если lastMoveAt не установлен, время еще не началось
        if (!game.lastMoveAt) {
          // Время еще не началось - не проверяем таймаут
          continue;
        }
        const referenceTime = game.lastMoveAt instanceof Date ? game.lastMoveAt : new Date(game.lastMoveAt);
        
        const timeSinceLastMove = now.getTime() - referenceTime.getTime();
        const timeSinceLastMoveSeconds = timeSinceLastMove / 1000;
        
        // Определяем текущего игрока
        const currentPlayerId = game.currentPlayer === 0 ? game.player1Id : game.player2Id;
        
        // Для игр с ботами - проверяем таймауты
        if (game.type === GameType.VS_BOT && game.player2Id === null) {
          // Определяем текущее время (15с на ход + овертайм)
          const baseMoveTime = 15;
          const currentPlayer = game.currentPlayer;
          const playerTimeRemaining = currentPlayer === 0 
            ? (game.player1TimeRemaining || 60000) 
            : (game.player2TimeRemaining || 60000);
          
          const excessTime = Math.max(0, timeSinceLastMoveSeconds - baseMoveTime);
          const totalRemaining = Math.max(0, (playerTimeRemaining / 1000) - excessTime);

          // ВАЖНО: Перед проверкой таймаута проверяем, есть ли у бота валидные ходы
          // Если ходов нет - сразу пропускаем ход, не дожидаясь таймаута
          if (currentPlayer === 1 && timeSinceLastMoveSeconds > 1) {
            // Проверяем наличие ходов у бота (только если прошла хотя бы 1 секунда, чтобы не спамить)
            try {
              const currentGame = await this.gamesService.findOne(game.id);
              if (currentGame.status === 'finished' || currentGame.status === 'abandoned') {
                continue;
              }
              
              // Проверяем наличие валидных ходов у бота
              const testBotMoves = await this.botService.makeBotMove(currentGame.gameState, currentGame.mode);
              const hasMoves = testBotMoves.length > 0;
              
              if (!hasMoves) {
                // Нет валидных ходов - сразу пропускаем ход
                const gameIdToSkip = game?.id ?? currentGame?.id;
                if (!gameIdToSkip) {
                  this.logger.error('Cannot skip bot turn: game id is missing');
                  continue;
                }
                this.logger.log(`🔄 Bot has no valid moves, skipping turn immediately (before timeout) for game ${gameIdToSkip}`);
                await this.gamesService.makeMove(gameIdToSkip, null, []);
                const updatedGameState = await this.gamesService.getGameState(gameIdToSkip);
                this.server.to(`game:${gameIdToSkip}`).emit('game_state', updatedGameState);
                await this.sendTimerUpdateForGame(gameIdToSkip);
                
                // После пропуска хода проверяем, нужно ли боту ходить снова
                const gameAfterSkip = await this.gamesService.findOne(gameIdToSkip);
                if (gameAfterSkip.currentPlayer === 1 && gameAfterSkip.status === 'in_progress') {
                  await this.handleBotTurnIfNeeded(gameIdToSkip);
                }
                continue; // Пропускаем проверку таймаута, т.к. ход уже переключен
              }
            } catch (error) {
              this.logger.error(`Error checking bot moves before timeout: ${error.message}`);
              // В случае ошибки продолжаем проверку таймаута
            }
          }

          if (timeSinceLastMoveSeconds > baseMoveTime && totalRemaining <= 0) {
            this.logger.warn(`⏱️ Bot game timeout detected for game ${game.id}, player ${currentPlayer} time expired. Move time: ${timeSinceLastMoveSeconds.toFixed(2)}s`);
            
            try {
              const currentGame = await this.gamesService.findOne(game.id);
              if (currentGame.status === 'finished' || currentGame.status === 'abandoned') {
                continue;
              }
              
              // Завершаем игру. ЕслиcurrentPlayer === 0, выиграл бот. Если 1, выиграл игрок.
              // Метод finishBotGameOnTimeout умеет это делать (он заставляет текущего игрока сдаться)
              const finishedGame = await this.gamesService.finishBotGameOnTimeout(game.id);
              const gameState = await this.gamesService.getGameState(game.id);
              
              this.server.to(`game:${game.id}`).emit('game_finished', {
                winnerId: finishedGame.winnerId,
                player1Score: finishedGame.player1Score,
                player2Score: finishedGame.player2Score,
                gameState,
                reason: 'timeout',
                game: {
                  player1Wins: finishedGame.player1Wins || 0,
                  player2Wins: finishedGame.player2Wins || 0,
                  matchesToWin: finishedGame.matchesToWin || 1,
                },
              });
              
              this.logger.log(`✅ Bot game ${game.id} finished due to timeout, winner: ${finishedGame.winnerId}`);
            } catch (error) {
              this.logger.error(`❌ Error handling bot game timeout for game ${game.id}:`, error);
            }
          }
          continue;
        }
        
        // Для обычных игр - система контроля времени: 15 секунд на ход, избыток вычитается из общего времени
        const currentPlayerTimeRemaining = game.currentPlayer === 0 
          ? (game.player1TimeRemaining || 60000) 
          : (game.player2TimeRemaining || 60000);
        
        const baseMoveTime = 15; // 15 секунд на ход (было 20)
        const excessTime = Math.max(0, timeSinceLastMoveSeconds - baseMoveTime);
        const timeAfterBaseMove = Math.max(0, currentPlayerTimeRemaining - (excessTime * 1000));
        
        // Проверяем, закончилось ли время (если прошло больше 15 сек и общее время <= 0)
        const isTimeOut = timeSinceLastMoveSeconds > baseMoveTime && timeAfterBaseMove <= 0;
        
        if (isTimeOut) {
          this.logger.warn(`⏱️ Time control timeout detected for game ${game.id}, currentPlayer: ${game.currentPlayer}, timeSinceLastMove: ${timeSinceLastMoveSeconds.toFixed(2)}s, timeRemaining: ${(currentPlayerTimeRemaining / 1000).toFixed(2)}s`);
          
          try {
            // Проверяем что игра еще активна
            const currentGame = await this.gamesService.findOne(game.id);
            if (currentGame.status === 'finished') {
              continue;
            }
            
            // Обновляем общее время игрока (вычитаем превышение)
            await this.gamesService.updatePlayerTotalTime(game.id, game.currentPlayer, 0);
            
            // Автоматически сдаем игру от имени игрока, у которого закончилось время
            await this.gamesService.resignGame(game.id, currentPlayerId);
            
            const gameState = await this.gamesService.getGameState(game.id);
            const finishedGame = await this.gamesService.findOne(game.id);
            
            // Уведомляем всех участников игры
            this.server.to(`game:${game.id}`).emit('game_finished', {
              winnerId: finishedGame.winnerId,
              player1Score: finishedGame.player1Score,
              player2Score: finishedGame.player2Score,
              gameState,
              reason: 'timeout',
              game: {
                player1Wins: finishedGame.player1Wins || 0,
                player2Wins: finishedGame.player2Wins || 0,
                matchesToWin: finishedGame.matchesToWin || 1,
              },
            });
            
            this.logger.log(`✅ Game ${game.id} finished due to time control timeout, winner: ${finishedGame.winnerId}`);
          } catch (error) {
            // Если игра уже завершена, игнорируем ошибку
            if (error.message && error.message.includes('уже завершена')) {
              continue;
            }
            this.logger.error(`❌ Error handling time control timeout for game ${game.id}:`, error);
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
    
    // ВАЖНО: Отправляем полное состояние игры с сервера при подключении
    // Это гарантирует, что клиент получит актуальное состояние из БД
    const gameState = await this.gamesService.getGameState(data.gameId);
    client.emit('game_state', gameState);
    
    // Также отправляем обновление таймеров для синхронизации времени
    await this.sendTimerUpdateForGame(data.gameId);
    
    this.logger.log(`✅ Player ${userId} joined game ${data.gameId}, sent full game state`);
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
      // Отправляем событие с уникальным ID для предотвращения дублирования на клиенте
      const eventId = `${data.gameId}_${Date.now()}_${userId}`;
      this.server.to(`game:${data.gameId}`).emit('dice_rolled', { dice, playerId: userId, eventId });
      
      // ВАЖНО: Проверяем наличие валидных ходов после броска кубиков
      // Если есть шашки на баре, но нет валидных ходов с бара - автоматически передаем ход
      const possibleMoves = await this.gamesService.getPossibleMoves(data.gameId, userId);
      const hasMoves = possibleMoves.allMoves.length > 0 && possibleMoves.allMoves.some(seq => seq.length > 0);
      
      // ВАЖНО: Проверка бара актуальна ТОЛЬКО для коротких нардов
      // В длинных нардах шашек на баре быть не может по правилам
      const currentGame = await this.gamesService.findOne(data.gameId);
      const isShortBackgammon = currentGame.mode === GameMode.SHORT;
      
      let hasBarButNoMoves = false;
      if (isShortBackgammon) {
        // Проверяем, есть ли шашки на баре у текущего игрока (только для коротких нардов)
        const currentPlayer = currentGame.currentPlayer;
        const bar = currentGame.gameState?.bar;
        const barValue = Array.isArray(bar) 
          ? bar[currentPlayer] 
          : (currentPlayer === 0 ? (bar?.white || 0) : (bar?.black || 0));
        
        // Если есть шашки на баре, но нет валидных ходов - автоматически передаем ход
        hasBarButNoMoves = barValue > 0 && !hasMoves;
      }
      
      if (!hasMoves || hasBarButNoMoves) {
        this.logger.log(`🔄 No possible moves for user ${userId}${hasBarButNoMoves ? ' (has checkers on bar but no valid bar moves)' : ''}, switching turn automatically`);
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
      this.logger.log(`✅ Emitting move_made event for gameId=${data.gameId}`, {
        currentPlayer: gameState.currentPlayer,
        dice: gameState.gameState?.dice,
        type: gameState.type,
        status: gameState.status
      });
      
      // ВАЖНО: Преобразуем ходы в формат для анимации (serverMoves)
      // Для обычных игроков тоже нужно передавать serverMoves для анимации
      const serverMoves = data.moves && data.moves.length > 0 
        ? data.moves.map((move: any) => ({
            from: move.from,
            to: move.to,
            die: move.die,
            steps: move.steps
          }))
        : [];
      
      // ВАЖНО: Эмитим move_made для обновления состояния на фронтенде
      // Добавляем playerId чтобы фронтенд мог определить, чей это ход
      const moveMadeData = {
        ...gameState,
        playerId: userId, // ID игрока, который сделал ход
        serverMoves: serverMoves.length > 0 ? serverMoves : undefined
      };
      this.server.to(`game:${data.gameId}`).emit('move_made', moveMadeData);
      // ВАЖНО: Также эмитим game_state для синхронизации состояния (как для ботов)
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
          game: {
            player1Wins: game.player1Wins || 0,
            player2Wins: game.player2Wins || 0,
            matchesToWin: game.matchesToWin || 1,
          },
        });
      } else {
        // ВАЖНО: После завершения хода нужно бросить кубики для следующего игрока
        // Проверяем состояние dice из gameState (который уже обновлен после makeMove)
        // Также проверяем состояние из самой игры для надежности
        const updatedGameAfterMove = await this.gamesService.findOne(data.gameId);
        const diceFromGameState = gameState.gameState?.dice;
        const diceFromGame = updatedGameAfterMove.gameState?.dice;
        const hasNoDiceInState = !diceFromGameState || (Array.isArray(diceFromGameState) && diceFromGameState.length === 0);
        const hasNoDiceInGame = !diceFromGame || (Array.isArray(diceFromGame) && diceFromGame.length === 0);
        const hasNoDice = hasNoDiceInState || hasNoDiceInGame;
        
        this.logger.log(`🔍 Checking if dice roll needed: hasNoDice=${hasNoDice}, hasNoDiceInState=${hasNoDiceInState}, hasNoDiceInGame=${hasNoDiceInGame}, status=${game.status}, diceFromState=${JSON.stringify(diceFromGameState)}, diceFromGame=${JSON.stringify(diceFromGame)}`);
        
        // ВАЖНО: Бросаем кубики если:
        // 1. Кубики пустые (ход завершен)
        // 2. Игра в процессе
        // 3. Оба игрока выбрали смещение (для всех типов игр)
        const bothOffsetsChosen = updatedGameAfterMove.p1OffsetChosenAt !== null && updatedGameAfterMove.p2OffsetChosenAt !== null;
        
        if (hasNoDice && game.status === 'in_progress' && bothOffsetsChosen) {
          // Ход завершен (все кубики использованы), нужно проверить валидные ходы
          // ВАЖНО: Если после использования всех кубиков нет валидных ходов - автоматически пропускаем ход
          const currentPlayerId = gameState.currentPlayer === 0 ? gameState.player1Id : gameState.player2Id;
          const isBotGame = gameState.type === 'vs_bot' && gameState.player2Id === null;
          
          // Для обычных игроков (не бот) проверяем валидные ходы после использования всех кубиков
          let shouldSkipTurn = false;
          if (!isBotGame && currentPlayerId) {
            try {
              const possibleMovesAfterAllDiceUsed = await this.gamesService.getPossibleMoves(data.gameId, currentPlayerId);
              const hasMovesAfterAllDiceUsed = possibleMovesAfterAllDiceUsed.allMoves.length > 0 && 
                                             possibleMovesAfterAllDiceUsed.allMoves.some(seq => seq.length > 0);
              
              // ВАЖНО: Проверка бара актуальна ТОЛЬКО для коротких нардов
              let hasBarButNoMoves = false;
              const isShortBackgammon = updatedGameAfterMove.mode === GameMode.SHORT;
              if (isShortBackgammon) {
                const bar = updatedGameAfterMove.gameState?.bar;
                const currentPlayer = gameState.currentPlayer;
                const barValue = Array.isArray(bar) 
                  ? bar[currentPlayer] 
                  : (currentPlayer === 0 ? (bar?.white || 0) : (bar?.black || 0));
                hasBarButNoMoves = barValue > 0 && !hasMovesAfterAllDiceUsed;
              }
              
              if (!hasMovesAfterAllDiceUsed || hasBarButNoMoves) {
                this.logger.log(`🔄 No possible moves after all dice used for player ${currentPlayerId}${hasBarButNoMoves ? ' (has checkers on bar but no valid bar moves)' : ''}, switching turn automatically`);
                // Переключаем ход автоматически
                await this.gamesService.makeMove(data.gameId, currentPlayerId, []);
                const updatedGameStateAfterSkip = await this.gamesService.getGameState(data.gameId);
                this.server.to(`game:${data.gameId}`).emit('move_made', updatedGameStateAfterSkip);
                this.server.to(`game:${data.gameId}`).emit('game_state', updatedGameStateAfterSkip);
                await this.sendTimerUpdateForGame(data.gameId);
                
                // Если игра завершена - выходим
                const finalGameAfterSkip = await this.gamesService.findOne(data.gameId);
                if (finalGameAfterSkip.status === 'finished') {
                  this.server.to(`game:${data.gameId}`).emit('game_finished', {
                    winnerId: finalGameAfterSkip.winnerId,
                    player1Score: finalGameAfterSkip.player1Score,
                    player2Score: finalGameAfterSkip.player2Score,
                    gameState: updatedGameStateAfterSkip,
                    game: {
                      player1Wins: finalGameAfterSkip.player1Wins || 0,
                      player2Wins: finalGameAfterSkip.player2Wins || 0,
                      matchesToWin: finalGameAfterSkip.matchesToWin || 1,
                    },
                  });
                  return;
                }
                
                // Обновляем gameState после пропуска хода
                const newGameState = await this.gamesService.getGameState(data.gameId);
                const newUpdatedGame = await this.gamesService.findOne(data.gameId);
                const newDiceFromGame = newUpdatedGame.gameState?.dice;
                const newHasNoDice = !newDiceFromGame || (Array.isArray(newDiceFromGame) && newDiceFromGame.length === 0);
                
                // Проверяем, нужно ли бросить кубики для следующего игрока
                const nextPlayerIdAfterSkip = newGameState.currentPlayer === 0 
                  ? newGameState.player1Id 
                  : newGameState.player2Id;
                const isBotTurnAfterSkip = newGameState.type === 'vs_bot' && 
                                          newGameState.player2Id === null && 
                                          newGameState.currentPlayer === 1;
                
                if (newHasNoDice && newUpdatedGame.status === 'in_progress' && bothOffsetsChosen) {
                  this.pendingDiceRolls.set(data.gameId, {
                    nextPlayerId: isBotTurnAfterSkip ? null : nextPlayerIdAfterSkip,
                    isBotTurn: isBotTurnAfterSkip,
                    gameId: data.gameId
                  });
                  
                  if (isBotTurnAfterSkip) {
                    setTimeout(async () => {
                      await this.executePendingDiceRoll(data.gameId);
                    }, 500);
                  }
                } else if (isBotTurnAfterSkip) {
                  await this.handleBotTurnIfNeeded(data.gameId);
                }
                
                return; // Выходим, т.к. ход переключен
              }
            } catch (e) {
              this.logger.error(`Error checking possible moves after all dice used: ${e.message}`);
            }
          }
          
          // Если ход не был пропущен, продолжаем обычную логику броска кубиков
          // Ход завершен, нужно бросить кубики для следующего игрока
          // ВАЖНО: Сохраняем информацию о необходимости броска кубиков и ждем события о завершении анимации
          const nextPlayerId = gameState.currentPlayer === 0 ? gameState.player1Id : gameState.player2Id;
          const isBotTurn = gameState.type === 'vs_bot' && gameState.player2Id === null && gameState.currentPlayer === 1;
          
          this.logger.log(`🎲 Waiting for move animation to complete before rolling dice: gameId=${data.gameId}, currentPlayer=${gameState.currentPlayer}, nextPlayerId=${nextPlayerId}, isBotTurn=${isBotTurn}`);
          
          // Сохраняем информацию о необходимости броска кубиков
          this.pendingDiceRolls.set(data.gameId, {
            nextPlayerId: isBotTurn ? null : nextPlayerId,
            isBotTurn,
            gameId: data.gameId
          });
          
          // Если это бот, не ждем события от фронтенда (бот не отправляет события)
          // Бросаем кубики сразу с небольшой задержкой
          if (isBotTurn) {
            setTimeout(async () => {
              await this.executePendingDiceRoll(data.gameId);
            }, 500);
          }
          // Для обычных игроков ждем события move_animation_complete от фронтенда
        } else {
          // Кубики еще есть - это промежуточный ход (например, при дублях)
          // ВАЖНО: Проверяем валидные ходы для игроков (как для ботов)
          // Если остались кубики, но нет валидных ходов - автоматически пропускаем ход
          const currentPlayerId = gameState.currentPlayer === 0 ? gameState.player1Id : gameState.player2Id;
          const isBotGame = gameState.type === 'vs_bot' && gameState.player2Id === null;
          
          // Для обычных игроков (не бот) проверяем валидные ходы после хода
          if (!isBotGame && currentPlayerId) {
            try {
              // ВАЖНО: Получаем актуальное состояние игры после хода для проверки
              const freshGameState = await this.gamesService.getGameState(data.gameId);
              const freshGame = await this.gamesService.findOne(data.gameId);
              
              // Проверяем, есть ли еще кубики
              const remainingDice = freshGameState.gameState?.dice || freshGame.gameState?.dice || [];
              const hasRemainingDice = Array.isArray(remainingDice) && remainingDice.length > 0;
              
              this.logger.log(`🔍 Checking moves after partial move: currentPlayer=${freshGameState.currentPlayer}, remainingDice=${JSON.stringify(remainingDice)}, hasRemainingDice=${hasRemainingDice}`);
              
              // ВАЖНО: Проверяем валидные ходы только если есть оставшиеся кубики
              // Если кубиков нет - ход уже завершен, и проверка будет в другом месте
              if (hasRemainingDice) {
                // ВАЖНО: getPossibleMoves должен учитывать оставшиеся кубики из freshGameState
                // Но getPossibleMoves использует состояние из БД, которое уже обновлено после makeMove
                // Поэтому оставшиеся кубики уже должны быть в состоянии
                const possibleMovesAfterMove = await this.gamesService.getPossibleMoves(data.gameId, currentPlayerId);
                const hasMovesAfterMove = possibleMovesAfterMove.allMoves.length > 0 && 
                                         possibleMovesAfterMove.allMoves.some(seq => seq.length > 0);
                
                this.logger.log(`🔍 Possible moves check after partial move: remainingDice=${JSON.stringify(remainingDice)}, allMoves.length=${possibleMovesAfterMove.allMoves.length}, hasNonEmptySequences=${hasMovesAfterMove}, sequences=${possibleMovesAfterMove.allMoves.map(s => s.length).join(',')}`);
                
                // ВАЖНО: Проверка бара актуальна ТОЛЬКО для коротких нардов
                let hasBarButNoMoves = false;
                const isShortBackgammon = freshGame.mode === GameMode.SHORT;
                if (isShortBackgammon) {
                  const bar = freshGame.gameState?.bar || freshGameState.gameState?.bar;
                  const currentPlayer = freshGameState.currentPlayer;
                  const barValue = Array.isArray(bar) 
                    ? bar[currentPlayer] 
                    : (currentPlayer === 0 ? (bar?.white || 0) : (bar?.black || 0));
                  hasBarButNoMoves = barValue > 0 && !hasMovesAfterMove;
                }
                
                // ВАЖНО: Если нет валидных ходов с оставшимися кубиками - переключаем ход
                if (!hasMovesAfterMove || hasBarButNoMoves) {
                  this.logger.log(`🔄 No possible moves after move for player ${currentPlayerId}${hasBarButNoMoves ? ' (has checkers on bar but no valid bar moves)' : ''}, remainingDice=${JSON.stringify(remainingDice)}, switching turn automatically`);
                  // Переключаем ход автоматически
                  await this.gamesService.makeMove(data.gameId, currentPlayerId, []);
                  const updatedGameStateAfterSkip = await this.gamesService.getGameState(data.gameId);
                  this.server.to(`game:${data.gameId}`).emit('move_made', updatedGameStateAfterSkip);
                  this.server.to(`game:${data.gameId}`).emit('game_state', updatedGameStateAfterSkip);
                  await this.sendTimerUpdateForGame(data.gameId);
                  
                  // Если игра завершена - выходим
                  const finalGameAfterSkip = await this.gamesService.findOne(data.gameId);
                  if (finalGameAfterSkip.status === 'finished') {
                    this.server.to(`game:${data.gameId}`).emit('game_finished', {
                      winnerId: finalGameAfterSkip.winnerId,
                      player1Score: finalGameAfterSkip.player1Score,
                      player2Score: finalGameAfterSkip.player2Score,
                      gameState: updatedGameStateAfterSkip,
                      game: {
                        player1Wins: finalGameAfterSkip.player1Wins || 0,
                        player2Wins: finalGameAfterSkip.player2Wins || 0,
                        matchesToWin: finalGameAfterSkip.matchesToWin || 1,
                      },
                    });
                    return;
                  }
                  
                  // Проверяем, нужно ли бросить кубики для следующего игрока
                  const nextPlayerIdAfterSkip = updatedGameStateAfterSkip.currentPlayer === 0 
                    ? updatedGameStateAfterSkip.player1Id 
                    : updatedGameStateAfterSkip.player2Id;
                  const isBotTurnAfterSkip = updatedGameStateAfterSkip.type === 'vs_bot' && 
                                            updatedGameStateAfterSkip.player2Id === null && 
                                            updatedGameStateAfterSkip.currentPlayer === 1;
                  
                  const diceAfterSkip = finalGameAfterSkip.gameState?.dice;
                  const hasNoDiceAfterSkip = !diceAfterSkip || (Array.isArray(diceAfterSkip) && diceAfterSkip.length === 0);
                  const bothOffsetsChosenAfterSkip = finalGameAfterSkip.p1OffsetChosenAt !== null && finalGameAfterSkip.p2OffsetChosenAt !== null;
                  
                  if (hasNoDiceAfterSkip && finalGameAfterSkip.status === 'in_progress' && bothOffsetsChosenAfterSkip) {
                    this.pendingDiceRolls.set(data.gameId, {
                      nextPlayerId: isBotTurnAfterSkip ? null : nextPlayerIdAfterSkip,
                      isBotTurn: isBotTurnAfterSkip,
                      gameId: data.gameId
                    });
                    
                    if (isBotTurnAfterSkip) {
                      setTimeout(async () => {
                        await this.executePendingDiceRoll(data.gameId);
                      }, 500);
                    }
                  } else if (isBotTurnAfterSkip) {
                    await this.handleBotTurnIfNeeded(data.gameId);
                  }
                  
                  return; // Выходим, т.к. ход переключен
                }
                // Если есть кубики и есть валидные ходы - продолжаем обычную логику
              }
            } catch (e) {
              this.logger.error(`Error checking possible moves after move: ${e.message}`);
            }
          }
          
          // Проверяем бота только если это его ход и кубики уже есть
          // Получаем актуальное состояние для логирования
          const currentGameForLog = await this.gamesService.findOne(data.gameId);
          const currentDiceForLog = currentGameForLog.gameState?.dice;
          const bothOffsetsChosenForLog = currentGameForLog.p1OffsetChosenAt !== null && currentGameForLog.p2OffsetChosenAt !== null;
          this.logger.log(`🔄 No dice roll needed (intermediate move or dice still available), dice=${JSON.stringify(currentDiceForLog)}, bothOffsetsChosen=${bothOffsetsChosenForLog}`);
          await this.handleBotTurnIfNeeded(data.gameId);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error in make_move:`, error);
      this.logger.error(`❌ Error details: message=${error.message}, stack=${error.stack}`);
      client.emit('error', { message: error.message });
    }
  }


  private async executePendingDiceRoll(gameId: string): Promise<void> {
    const pending = this.pendingDiceRolls.get(gameId);
    if (!pending) {
      return; // Нет отложенного броска
    }
    
    this.pendingDiceRolls.delete(gameId);
    
    try {
      const dice = await this.gamesService.rollDice(pending.gameId, pending.nextPlayerId, pending.isBotTurn);
      this.logger.log(`✅ Dice rolled after animation complete: [${dice.join(', ')}]`);
      
      const eventId = `${pending.gameId}_${Date.now()}_after_animation`;
      this.server.to(`game:${pending.gameId}`).emit('dice_rolled', { 
        dice: dice, 
        playerId: pending.nextPlayerId,
        eventId
      });
      
      const updatedGameState = await this.gamesService.getGameState(pending.gameId);
      this.server.to(`game:${pending.gameId}`).emit('game_state', updatedGameState);
      
      // Если это ход бота - запускаем автоматический ход бота
      if (pending.isBotTurn) {
        this.logger.log(`Bot turn detected, triggering bot move`);
        setTimeout(async () => {
          await this.handleBotTurnIfNeeded(pending.gameId);
        }, 1000);
      }
    } catch (error) {
      this.logger.error(`Error executing pending dice roll:`, error);
    }
  }

  /**
   * Обработчик события о завершении анимации хода от фронтенда
   */
  @SubscribeMessage('move_animation_complete')
  async handleMoveAnimationComplete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    const gameId = data.gameId;
    if (!gameId) {
      return;
    }
    
    this.logger.log(`Move animation complete received for gameId=${gameId}`);
    
    // Выполняем отложенный бросок кубиков
    await this.executePendingDiceRoll(gameId);
  }

  async handleBotTurnIfNeeded(gameId: string): Promise<void> {
    try {
      const game = await this.gamesService.findOne(gameId);
      
      // Check if it's a bot game and bot's turn
      if (game.type === 'vs_bot' && game.player2Id === null && game.currentPlayer === 1 && game.status === 'in_progress') {
        const botPlayerId = null; // Use null for bot
        
        // ВАЖНО: Проверяем, есть ли уже кубики для бота
        // Если кубики уже есть - не бросаем повторно
        const hasDice = game.gameState?.dice && Array.isArray(game.gameState.dice) && game.gameState.dice.length > 0;
        
        if (hasDice) {
          this.logger.log(`🤖 Bot already has dice: [${game.gameState.dice.join(', ')}], proceeding with move`);
        } else {
          // Roll dice for bot
          this.logger.log(`🎲 Rolling dice for bot`);
          const botDice = await this.gamesService.rollDice(gameId, botPlayerId);
          
          // Применяем износ к кубикам бота после броска (Equipment Spec v2.0 - PER_ROLL)
          // Бот-игры обычно не тратят износ, но для консистентности можно оставить
          // TODO: Решить, нужно ли применять износ для бот-игр
          
          const gameStateAfterDice = await this.gamesService.getGameState(gameId);
          
          // Emit dice rolled event с уникальным ID для предотвращения дублирования
          const eventId = `${gameId}_${Date.now()}_bot`;
          this.server.to(`game:${gameId}`).emit('dice_rolled', { 
            dice: botDice, 
            playerId: null,
            eventId
          });
          this.server.to(`game:${gameId}`).emit('game_state', gameStateAfterDice);
        }
        
        // Получаем актуальное состояние игры (с кубиками)
        const updatedGame = await this.gamesService.findOne(gameId);
        const gameStateAfterDice = await this.gamesService.getGameState(gameId);
        
        // ВАЖНО: Проверяем наличие валидных ходов после броска (как и для обычных игроков)
        // Это работает для ВСЕХ режимов (короткие и длинные нарды)
        // Если нет валидных ходов - автоматически передаем ход
        // ВАЖНО: Проверяем через makeBotMove - это самый надежный способ
        // getPossibleMoves может возвращать пустые последовательности, что может дать ложный результат
        let hasMoves = false;
        
        try {
          // ПРОВЕРКА 1: Через makeBotMove - это основной и самый надежный способ
          const testBotMoves = await this.botService.makeBotMove(updatedGame.gameState, updatedGame.mode);
          hasMoves = testBotMoves.length > 0;
          this.logger.log(`🤖 Bot move check via makeBotMove: ${testBotMoves.length} moves found, hasMoves=${hasMoves}, dice=${JSON.stringify(updatedGame.gameState?.dice)}`);
          
          // ПРОВЕРКА 2: Дополнительная проверка через getPossibleMoves для логирования
          if (!hasMoves) {
            try {
              const possibleMoves = await this.gamesService.getPossibleMoves(gameId, botPlayerId);
              const hasMovesFromGetPossible = possibleMoves.allMoves.length > 0 && possibleMoves.allMoves.some(seq => seq.length > 0);
              this.logger.log(`🤖 Bot getPossibleMoves check: allMoves.length=${possibleMoves.allMoves.length}, hasNonEmptySequences=${hasMovesFromGetPossible}`);
              
              // Если getPossibleMoves говорит, что есть ходы, но makeBotMove вернул пустой массив - это странно
              // В этом случае доверяем makeBotMove, так как он реально пытается сделать ход
              if (hasMovesFromGetPossible && !hasMoves) {
                this.logger.warn(`⚠️ Discrepancy: getPossibleMoves says there are moves, but makeBotMove returned empty. Trusting makeBotMove.`);
              }
            } catch (error) {
              this.logger.warn(`Error getting possible moves for bot (secondary check): ${error.message}`);
            }
          }
        } catch (error) {
          this.logger.error(`❌ Error checking bot moves via makeBotMove: ${error.message}`);
          // В случае ошибки пробуем через getPossibleMoves как fallback
          try {
            const possibleMoves = await this.gamesService.getPossibleMoves(gameId, botPlayerId);
            hasMoves = possibleMoves.allMoves.length > 0 && possibleMoves.allMoves.some(seq => seq.length > 0);
            this.logger.log(`🤖 Fallback check via getPossibleMoves: hasMoves=${hasMoves}`);
          } catch (fallbackError) {
            this.logger.error(`❌ Error in fallback getPossibleMoves check: ${fallbackError.message}`);
          }
        }
        
        // Проверяем, есть ли шашки на баре у бота (для коротких нардов)
        // ВАЖНО: Используем актуальное состояние игры после броска кубиков
        const bar = updatedGame.gameState?.bar || gameStateAfterDice.gameState?.bar;
        const barValue = Array.isArray(bar) 
          ? bar[1] // Бот всегда player 1
          : (bar?.black || 0);
        
        // Если есть шашки на баре, но нет валидных ходов - автоматически передаем ход (только для коротких нардов)
        const isShortBackgammon = updatedGame.mode === GameMode.SHORT;
        const hasBarButNoMoves = isShortBackgammon && barValue > 0 && !hasMoves;
        
        // ВАЖНО: Если нет валидных ходов (для любых нардов) - автоматически передаем ход
        // Проверяем для всех режимов: короткие и длинные нарды
        if (!hasMoves || hasBarButNoMoves) {
          this.logger.log(`🔄 No possible moves for bot${hasBarButNoMoves ? ' (has checkers on bar but no valid bar moves)' : ''} in ${isShortBackgammon ? 'short' : 'long'} backgammon, switching turn automatically for game ${gameId}, dice=${JSON.stringify(updatedGame.gameState?.dice || gameStateAfterDice.gameState?.dice)}`);
          try {
            await this.gamesService.makeMove(gameId, botPlayerId, []);
            const finalGame = await this.gamesService.findOne(gameId);
            if (finalGame.status !== 'in_progress') return;
            const bothOffsetsChosen = finalGame.p1OffsetChosenAt != null && finalGame.p2OffsetChosenAt != null;
            if (finalGame.currentPlayer === 0 && bothOffsetsChosen) {
              // Пропуск без анимации — сразу бросаем кубики игроку, иначе pendingDiceRolls никогда не выполнится
              const playerDice = await this.gamesService.rollDice(gameId, finalGame.player1Id);
              const eventId = `${gameId}_${Date.now()}_after_skip`;
              this.server.to(`game:${gameId}`).emit('dice_rolled', { dice: playerDice, playerId: finalGame.player1Id, eventId });
              const updatedGameState = await this.gamesService.getGameState(gameId);
              this.server.to(`game:${gameId}`).emit('game_state', updatedGameState);
            } else {
              const updatedGameState = await this.gamesService.getGameState(gameId);
              this.server.to(`game:${gameId}`).emit('game_state', updatedGameState);
            }
            await this.sendTimerUpdateForGame(gameId);
            return;
          } catch (e) {
            this.logger.error(`Error in auto-skip turn for bot: ${e.message}`);
            return;
          }
        }
        
        // Делаем ход бота с задержкой 1 секунда, чтобы игрок мог увидеть кубики и ход бота
        try {
          // Задержка 1 секунда после броска кубиков, чтобы игрок мог увидеть результат
          const delay = 1000;
          this.logger.log(`🤖 Bot move delay: ${delay}ms for gameId=${gameId}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
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
          
          // Если у бота не было ходов (botMoves.length === 0), makeMove уже переключил ход на игрока
          // В этом случае нужно бросить кубики для игрока и выйти
          if (botMoves.length === 0) {
            this.logger.log(`🔄 Bot had no valid moves, turn switched to player for gameId=${gameId}`);
            this.server.to(`game:${gameId}`).emit('game_state', gameStateAfterMove);
            await this.sendTimerUpdateForGame(gameId);
            
            // ВАЖНО: После переключения хода на игрока нужно бросить кубики для игрока
            // Проверяем, что кубики пустые и игра в процессе
            const finalGame = await this.gamesService.findOne(gameId);
            if (finalGame.status === 'in_progress') {
              const diceFromGame = finalGame.gameState?.dice;
              const hasNoDice = !diceFromGame || (Array.isArray(diceFromGame) && diceFromGame.length === 0);
              const bothOffsetsChosen = finalGame.p1OffsetChosenAt !== null && finalGame.p2OffsetChosenAt !== null;
              
              if (hasNoDice && bothOffsetsChosen && finalGame.currentPlayer === 0) {
                // Сохраняем информацию о необходимости броска кубиков и ждем события о завершении анимации
                this.logger.log(`Waiting for move animation to complete before rolling dice for player after bot skip: gameId=${gameId}`);
                this.pendingDiceRolls.set(gameId, {
                  nextPlayerId: finalGame.player1Id,
                  isBotTurn: false,
                  gameId: gameId
                });
              }
            }
            
            return; // Выходим, т.к. ход переключен на игрока
          }
          
          // Emit move_made event (или просто game_state если ходов не было)
          // ВАЖНО: Передаем botMoves для анимации на фронтенде
          const moveMadeData = {
            ...gameStateAfterMove,
            serverMoves: botMoves // Добавляем список ходов для анимации
          };
          this.server.to(`game:${gameId}`).emit('move_made', moveMadeData);
          
          // Check if game finished
          if (botMoveResult.status === 'finished') {
            this.server.to(`game:${gameId}`).emit('game_finished', {
              winnerId: botMoveResult.winnerId,
              player1Score: botMoveResult.player1Score,
              player2Score: botMoveResult.player2Score,
              gameState: gameStateAfterMove,
              serverMoves: botMoves, // Добавляем ходы даже при завершении игры
              game: {
                player1Wins: botMoveResult.player1Wins || 0,
                player2Wins: botMoveResult.player2Wins || 0,
                matchesToWin: botMoveResult.matchesToWin || 1,
              },
            });
          } else {
            // After bot move, check if it's still bot's turn or player's turn
            const finalGame = await this.gamesService.findOne(gameId);
            if (finalGame.status === 'finished') return;
            
            if (finalGame.currentPlayer === 0) {
              this.logger.log(`Player's turn after bot move for gameId=${gameId}`);
              
              // ВАЖНО: После хода бота нужно бросить кубики для игрока
              const diceFromGame = finalGame.gameState?.dice;
              const hasNoDice = !diceFromGame || (Array.isArray(diceFromGame) && diceFromGame.length === 0);
              const bothOffsetsChosen = finalGame.p1OffsetChosenAt !== null && finalGame.p2OffsetChosenAt !== null;
              
              if (hasNoDice && bothOffsetsChosen && finalGame.status === 'in_progress') {
                // Сохраняем информацию о необходимости броска кубиков и ждем события о завершении анимации
                this.logger.log(`Waiting for move animation to complete before rolling dice for player after bot move: gameId=${gameId}`);
                this.pendingDiceRolls.set(gameId, {
                  nextPlayerId: finalGame.player1Id,
                  isBotTurn: false,
                  gameId: gameId
                });
              }
            } else {
              // Если все еще ход бота (например, в длинных нардах не все кубики использованы),
              // но ходов больше нет - makeMove уже должен был переключить ход.
              // Если не переключил - значит бот должен ходить дальше.
              this.logger.log(`🤖 Still bot's turn, recursively calling handleBotTurnIfNeeded for gameId=${gameId}`);
              await this.handleBotTurnIfNeeded(gameId);
            }
          }
        } catch (error) {
          this.logger.error(`Bot move error: ${error.message}`, error.stack);
          
          // Fallback: если бот упал с ошибкой, пытаемся сделать любой валидный ход или пропустить ход
          try {
            this.logger.warn(`⚠️ Attempting fallback move for bot in game ${gameId}`);
            
            // Получаем возможные ходы заново
            const possibleMoves = await this.gamesService.getPossibleMoves(gameId, botPlayerId);
            
            let movesToMake: any[] = [];
            if (possibleMoves.allMoves.length > 0 && possibleMoves.allMoves.some(seq => seq.length > 0)) {
               // Берем первую последовательность ходов (она обычно самая длинная или первая валидная)
               // Ищем первую непустую последовательность
               movesToMake = possibleMoves.allMoves.find(seq => seq.length > 0) || [];
            }
            
            this.logger.log(`🤖 Fallback bot moves: ${movesToMake.length}, calling makeMove`);
            
            // Если ходов нет, makeMove должен переключить ход
            // Если ходы есть, применяем их
            const moveResult = await this.gamesService.makeMove(gameId, botPlayerId, movesToMake);
            const gameStateAfterMove = await this.gamesService.getGameState(gameId);
            
            // Отправляем обновление состояния (так как нормальный флоу прервался ошибкой)
            this.server.to(`game:${gameId}`).emit('game_state', gameStateAfterMove);
            await this.sendTimerUpdateForGame(gameId);
            
            // Если игра завершена
            if (moveResult.status === 'finished') {
               this.server.to(`game:${gameId}`).emit('game_finished', {
                 winnerId: moveResult.winnerId,
                 player1Score: moveResult.player1Score,
                 player2Score: moveResult.player2Score,
                 gameState: gameStateAfterMove,
                 game: {
                   player1Wins: moveResult.player1Wins || 0,
                   player2Wins: moveResult.player2Wins || 0,
                   matchesToWin: moveResult.matchesToWin || 1,
                 },
               });
               return;
            }

            // Если ход все еще у бота (и игра не завершена)
            if (gameStateAfterMove.currentPlayer === 1) {
               // Если мы сделали ходы, но ход не перешел (например, неполный ход, но больше некуда)
               // makeMove должен был переключить ход, если больше некуда.
               // Если ход остался, значит можно ходить еще?
               // Рекурсивно вызываем handleBotTurnIfNeeded
               await this.handleBotTurnIfNeeded(gameId);
            }
          } catch (fallbackError) {
            this.logger.error(`❌ Bot fallback move failed: ${fallbackError.message}`, fallbackError.stack);
            
            // Последняя попытка: принудительно переключить ход, если ничего не помогает
            // Но мы не можем просто изменить currentPlayer без логики движка.
            // Если движок считает, что ходы есть, мы застряли.
            // Но это крайний случай.
          }
        }
      }
    } catch (error) {
      console.error(`Bot turn check error: ${error.message}`, error.stack);
    }
  }
}
