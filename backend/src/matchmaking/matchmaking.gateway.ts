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
import { UseGuards } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { GamesService } from '../games/games.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GameMode } from '../games/game.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/matchmaking',
})
export class MatchmakingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private matchmakingIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private matchmakingService: MatchmakingService,
    private gamesService: GamesService,
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
        
        client.emit('match_found', { gameId: game.id, opponentId });
        this.server.to(`user:${opponentId}`).emit('match_found', { gameId: game.id, opponentId: userId });
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
    const gameId = await this.matchmakingService.createOpenTable(userId, data.mode, data.timeLimit);
    client.emit('table_created', { gameId });
  }

  @SubscribeMessage('join_table')
  async handleJoinTable(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    const userId = client.data.userId;
    try {
      await this.matchmakingService.joinTable(data.gameId, userId);
      const game = await this.gamesService.findOne(data.gameId);
      this.server.to(`table:${data.gameId}`).emit('table_joined', { gameId: data.gameId, game });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }
}

