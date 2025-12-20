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
import { Inject, forwardRef } from '@nestjs/common';

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
    @Inject(forwardRef(() => BotService))
    private botService: BotService,
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
      const gameState = await this.gamesService.getGameState(data.gameId);
      this.server.to(`game:${data.gameId}`).emit('dice_rolled', { dice, playerId: userId });
      this.server.to(`game:${data.gameId}`).emit('game_state', gameState);
      
      // Bot auto-move is now handled in games.service.ts after makeMove
      // This ensures proper sequencing and state management
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
        // Roll dice for bot
        const botDice = await this.gamesService.rollDice(gameId, game.player1Id);
        const gameStateAfterDice = await this.gamesService.getGameState(gameId);
        
        // Emit dice rolled event
        this.server.to(`game:${gameId}`).emit('dice_rolled', { 
          dice: botDice, 
          playerId: null 
        });
        this.server.to(`game:${gameId}`).emit('game_state', gameStateAfterDice);
        
        // Wait and make bot move
        setTimeout(async () => {
          try {
            const updatedGame = await this.gamesService.findOne(gameId);
            if (updatedGame.status === 'finished') return;
            
            const botMoves = await this.botService.makeBotMove(updatedGame.gameState, updatedGame.mode);
            if (botMoves.length > 0) {
              const botMoveResult = await this.gamesService.makeMove(gameId, game.player1Id, botMoves);
              const gameStateAfterMove = await this.gamesService.getGameState(gameId);
              
              // Emit move_made event
              this.server.to(`game:${gameId}`).emit('move_made', gameStateAfterMove);
              
              // Check if game finished
              if (botMoveResult.status === 'finished') {
                this.server.to(`game:${gameId}`).emit('game_finished', {
                  winnerId: botMoveResult.winnerId,
                  player1Score: botMoveResult.player1Score,
                  player2Score: botMoveResult.player2Score,
                  gameState: gameStateAfterMove,
                });
              } else {
                // Recursively check if bot needs to move again (if it's still bot's turn)
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

