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
import { UseGuards, Logger } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { GamesService } from '../games/games.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GameMode } from '../games/game.entity';
import axios from 'axios';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/matchmaking',
})
export class MatchmakingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MatchmakingGateway.name);
  private matchmakingIntervals = new Map<string, NodeJS.Timeout>();
  private joinTimeouts = new Map<string, NodeJS.Timeout>(); // Таймауты для игроков, присоединившихся к столу

  constructor(
    private matchmakingService: MatchmakingService,
    private gamesService: GamesService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

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

      client.data.userId = payload.sub;
      
      // Присоединяем пользователя к комнате для отправки событий
      await client.join(`user:${payload.sub}`);
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.matchmakingService.leaveQueue(userId);
      const interval = this.matchmakingIntervals.get(userId);
      if (interval) {
        clearInterval(interval);
        this.matchmakingIntervals.delete(userId);
      }
    }
  }

  @SubscribeMessage('find_match')
  async handleFindMatch(@ConnectedSocket() client: Socket, @MessageBody() data: { mode: GameMode }) {
    const userId = client.data.userId;
    
    await this.matchmakingService.joinQueue(userId, data.mode);

    const interval = setInterval(async () => {
      const opponentId = await this.matchmakingService.findMatch(userId, data.mode);
      if (opponentId) {
        clearInterval(interval);
        this.matchmakingIntervals.delete(userId);
        
        const game = await this.gamesService.create(userId, opponentId, data.mode, 'vs_player' as any);
        
        // Отправляем события обоим игрокам
        client.emit('match_found', { gameId: game.id, opponentId });
        this.server.to(`user:${opponentId}`).emit('match_found', { gameId: game.id, opponentId: userId });
        
        // Отправляем уведомления в Telegram
        await this.sendTelegramNotification(userId, `🎮 Найден соперник! Игра #${game.id.substring(0, 8)}`);
        await this.sendTelegramNotification(opponentId, `🎮 Найден соперник! Игра #${game.id.substring(0, 8)}`);
      }
    }, 2000);

    this.matchmakingIntervals.set(userId, interval);
    client.emit('searching');
  }

  @SubscribeMessage('cancel_search')
  async handleCancelSearch(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    await this.matchmakingService.leaveQueue(userId);
    
    const interval = this.matchmakingIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.matchmakingIntervals.delete(userId);
    }
    
    client.emit('search_cancelled');
  }

  @SubscribeMessage('get_open_tables')
  async handleGetOpenTables(@ConnectedSocket() client: Socket, @MessageBody() data: { mode: GameMode }) {
    const tables = await this.matchmakingService.getOpenTables(data.mode);
    client.emit('open_tables', tables);
  }

  @SubscribeMessage('create_table')
  async handleCreateTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { mode: GameMode; timeLimit: number; stake?: number },
  ) {
    const userId = client.data.userId;
    try {
      const gameId = await this.matchmakingService.createOpenTable(userId, data.mode, data.timeLimit, data.stake || 0);
      
      // Сначала отправляем событие клиенту, чтобы он не завис
      client.emit('table_created', { gameId });
      
      // Затем обновляем список столов и отправляем уведомление (не блокируем основной поток)
      Promise.all([
        this.matchmakingService.getOpenTables(data.mode).then(tables => {
          this.server.emit('open_tables', tables);
        }),
        this.sendTelegramNotification(userId, `🪑 Стол создан! ID игры: #${gameId.substring(0, 8)}`).catch(err => {
          this.logger.warn(`Не удалось отправить уведомление в Telegram: ${err.message}`);
        }),
      ]).catch(err => {
        this.logger.error(`Ошибка при обработке созданного стола: ${err.message}`);
      });
    } catch (error) {
      this.logger.error(`Ошибка при создании стола: ${error.message}`);
      client.emit('error', { message: error.message || 'Ошибка при создании стола' });
    }
  }

  @SubscribeMessage('join_table')
  async handleJoinTable(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    const userId = client.data.userId;
    try {
      await this.matchmakingService.joinTable(data.gameId, userId);
      const game = await this.gamesService.findOne(data.gameId);
      
      // Отправляем событие клиенту
      client.emit('table_joined', { gameId: data.gameId, game });
      
      // Уведомляем первого игрока о том, что второй присоединился
      if (game.player1Id && game.player1Id !== userId) {
        this.server.to(`user:${game.player1Id}`).emit('opponent_joined', { gameId: data.gameId, game });
        await this.sendTelegramNotification(game.player1Id, `✅ Игрок присоединился к столу! Игра #${data.gameId.substring(0, 8)}`);
      }
      await this.sendTelegramNotification(userId, `✅ Вы присоединились к столу! Игра #${data.gameId.substring(0, 8)}`);
      
      // Отправляем обновление списка столов всем подписчикам
      const tables = await this.matchmakingService.getOpenTables(game.mode);
      this.server.emit('open_tables', tables);
      
      // Если оба игрока уже в лобби (оба присоединились), устанавливаем таймауты для обоих
      if (game.player1Id && game.player2Id) {
        // Устанавливаем таймаут 60 секунд для обоих игроков
        const timeoutDelay = 60000; // 60 секунд
        
        // Таймаут для первого игрока
        const timeoutKey1 = `${data.gameId}:${game.player1Id}`;
        const timeout1 = setTimeout(async () => {
          await this.handlePlayerTimeout(data.gameId, game.player1Id);
          this.joinTimeouts.delete(timeoutKey1);
        }, timeoutDelay);
        this.joinTimeouts.set(timeoutKey1, timeout1);
        
        // Таймаут для второго игрока
        const timeoutKey2 = `${data.gameId}:${game.player2Id}`;
        const timeout2 = setTimeout(async () => {
          await this.handlePlayerTimeout(data.gameId, game.player2Id);
          this.joinTimeouts.delete(timeoutKey2);
        }, timeoutDelay);
        this.joinTimeouts.set(timeoutKey2, timeout2);
        
        this.logger.log(`⏱️ Таймауты установлены для обоих игроков стола ${data.gameId}`);
      }
    } catch (error) {
      this.logger.error(`Ошибка при присоединении к столу: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('ready_to_start')
  async handleReadyToStart(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    const userId = client.data.userId;
    try {
      // Отменяем таймаут, так как игрок нажал "Начать игру"
      const timeoutKey = `${data.gameId}:${userId}`;
      const timeout = this.joinTimeouts.get(timeoutKey);
      if (timeout) {
        clearTimeout(timeout);
        this.joinTimeouts.delete(timeoutKey);
      }

      const readyStatus = await this.matchmakingService.setPlayerReady(data.gameId, userId);
      const game = await this.gamesService.findOne(data.gameId);
      
      // Если оба игрока готовы, начинаем игру
      if (readyStatus.bothReady) {
        game.status = 'in_progress' as any;
        await this.gamesService['gamesRepository'].save(game);
        
        // Удаляем стол из списка открытых, так как игра началась
        await this.matchmakingService.deleteTableFromRedis(data.gameId);
        
        // Отправляем событие начала игры обоим игрокам
        this.server.to(`user:${game.player1Id}`).emit('game_started', { gameId: data.gameId, game });
        this.server.to(`user:${game.player2Id}`).emit('game_started', { gameId: data.gameId, game });
        
        // Отправляем обновление списка столов всем подписчикам
        const tables = await this.matchmakingService.getOpenTables(game.mode);
        this.server.emit('open_tables', tables);
        
        // Отправляем уведомления в Telegram
        await this.sendTelegramNotification(game.player1Id, `🎮 Игра началась! Игра #${data.gameId.substring(0, 8)}`);
        await this.sendTelegramNotification(game.player2Id, `🎮 Игра началась! Игра #${data.gameId.substring(0, 8)}`);
      } else {
        // Отправляем обновление статуса готовности обоим игрокам
        const readyStatusData = {
          gameId: data.gameId,
          player1Ready: readyStatus.player1Ready,
          player2Ready: readyStatus.player2Ready,
        };
        
        client.emit('ready_status', readyStatusData);
        
        // Уведомляем другого игрока
        const otherPlayerId = game.player1Id === userId ? game.player2Id : game.player1Id;
        if (otherPlayerId) {
          this.server.to(`user:${otherPlayerId}`).emit('ready_status', readyStatusData);
        }
      }
    } catch (error) {
      this.logger.error(`Ошибка при готовности к старту: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  private async handlePlayerTimeout(gameId: string, userId: string): Promise<void> {
    try {
      const game = await this.gamesService.findOne(gameId);
      
      // Проверяем, что игра все еще в статусе waiting и этот игрок еще не готов
      if (game.status !== 'waiting') {
        return; // Игра уже началась, таймаут не нужен
      }

      // Проверяем готовность игрока
      const ready = await this.matchmakingService.getReadyStatus(gameId);
      if (ready) {
        const isPlayer1 = game.player1Id === userId;
        if (isPlayer1 && ready.player1Ready) {
          return; // Игрок уже готов, таймаут не нужен
        }
        if (!isPlayer1 && ready.player2Ready) {
          return; // Игрок уже готов, таймаут не нужен
        }
      }

      // Удаляем игрока из игры
      if (game.player1Id === userId) {
        // Если это первый игрок (создатель стола), удаляем игру полностью
        game.status = 'abandoned' as any;
        await this.gamesService['gamesRepository'].save(game);
        this.server.to(`user:${game.player2Id || ''}`).emit('player_timeout', { gameId, timeoutPlayerId: userId });
      } else if (game.player2Id === userId) {
        // Если это второй игрок, удаляем его из игры и открываем стол снова
        game.player2Id = null;
        await this.gamesService['gamesRepository'].save(game);
        
        // Блокируем этого игрока от повторного присоединения к этому столу
        await this.matchmakingService.blockPlayerFromTable(gameId, userId);
        
        // Возвращаем стол в список открытых
        await this.matchmakingService.reopenTable(
          gameId,
          game.player1Id,
          game.mode,
          game.moveTimeLimit || 60000,
          game.createdAt.getTime(),
        );
        
        // Удаляем запись о готовности
        await this.matchmakingService.clearReadyStatus(gameId);
        
        // Уведомляем первого игрока
        this.server.to(`user:${game.player1Id}`).emit('player_timeout', { gameId, timeoutPlayerId: userId });
        await this.sendTelegramNotification(game.player1Id, `⏱️ Игрок не подтвердил готовность. Ожидание нового соперника... Игра #${gameId.substring(0, 8)}`);
      }
    } catch (error) {
      this.logger.error(`Ошибка при обработке таймаута игрока: ${error.message}`);
    }
  }

  private async sendTelegramNotification(userId: string, message: string): Promise<void> {
    try {
      const user = await this.usersService.findOne(userId);
      if (!user || !user.telegramId || user.isGuest) {
        // Пропускаем уведомления для гостей или пользователей без telegramId
        return;
      }

      const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
      if (!botToken) {
        this.logger.warn('TELEGRAM_BOT_TOKEN не настроен, уведомление не отправлено');
        return;
      }

      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: user.telegramId,
        text: message,
      });
    } catch (error) {
      // Логируем ошибку, но не прерываем выполнение
      this.logger.warn(`Не удалось отправить уведомление в Telegram пользователю ${userId}: ${error.message}`);
    }
  }
}

