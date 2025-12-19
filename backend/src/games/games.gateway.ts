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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/games',
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>();

  constructor(
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

      this.connectedUsers.set(client.id, payload.sub);
      client.data.userId = payload.sub;
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedUsers.delete(client.id);
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
      this.server.to(`game:${data.gameId}`).emit('dice_rolled', { dice, playerId: userId });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('make_move')
  async handleMakeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; moves: Array<{ from: number; to: number; die: number }> },
  ) {
    const userId = client.data.userId;
    try {
      const game = await this.gamesService.makeMove(data.gameId, userId, data.moves);
      this.server.to(`game:${data.gameId}`).emit('move_made', await this.gamesService.getGameState(data.gameId));
      
      if (game.status === 'finished') {
        this.server.to(`game:${data.gameId}`).emit('game_finished', {
          winnerId: game.winnerId,
          player1Score: game.player1Score,
          player2Score: game.player2Score,
        });
      }
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }
}

