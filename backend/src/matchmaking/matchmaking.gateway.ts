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
    @MessageBody() data: { mode: GameMode; timeLimit: number },
  ) {
    const userId = client.data.userId;
    try {
      const gameId = await this.matchmakingService.createOpenTable(userId, data.mode, data.timeLimit);
      client.emit('table_created', { gameId });
      
      // Отправляем уведомление в Telegram
      await this.sendTelegramNotification(userId, `🪑 Стол создан! ID игры: #${gameId.substring(0, 8)}`);
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
    } catch (error) {
      this.logger.error(`Ошибка при присоединении к столу: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('ready_to_start')
  async handleReadyToStart(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    const userId = client.data.userId;
    try {
      const readyStatus = await this.matchmakingService.setPlayerReady(data.gameId, userId);
      const game = await this.gamesService.findOne(data.gameId);
      
      // Если оба игрока готовы, начинаем игру
      if (readyStatus.bothReady) {
        game.status = 'in_progress' as any;
        await this.gamesService['gamesRepository'].save(game);
        
        // Отправляем событие начала игры обоим игрокам
        this.server.to(`user:${game.player1Id}`).emit('game_started', { gameId: data.gameId, game });
        this.server.to(`user:${game.player2Id}`).emit('game_started', { gameId: data.gameId, game });
        
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

