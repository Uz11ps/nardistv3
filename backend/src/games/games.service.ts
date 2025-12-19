import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameMode, GameStatus, GameType } from './game.entity';
import { GameMove } from './game-move.entity';
import { BackgammonEngine } from './game-engine/backgammon-engine';
import { LongBackgammonEngine } from './game-engine/long-backgammon-engine';
import { ProgressService } from '../progress/progress.service';
import { RatingsService } from '../ratings/ratings.service';
import * as crypto from 'crypto';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameMove)
    private movesRepository: Repository<GameMove>,
    private backgammonEngine: BackgammonEngine,
    private longBackgammonEngine: LongBackgammonEngine,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
    @Inject(forwardRef(() => RatingsService))
    private ratingsService: RatingsService,
  ) {}

  async create(
    player1Id: string,
    player2Id: string | null,
    mode: GameMode,
    type: GameType,
  ): Promise<Game> {
    // Проверка жизней для player1 (только для игр с игроками)
    if (type === GameType.VS_PLAYER) {
      const hasLives = await this.progressService.checkLives(player1Id);
      if (!hasLives) {
        throw new BadRequestException('Недостаточно жизней для начала игры. Восстановите жизни или купите их.');
      }
    }

    // Проверка жизней для player2
    if (player2Id && type === GameType.VS_PLAYER) {
      const hasLives = await this.progressService.checkLives(player2Id);
      if (!hasLives) {
        throw new BadRequestException('У противника недостаточно жизней');
      }
    }

    // Проверка энергии для player1 (бот-игры не тратят энергию)
    if (type !== GameType.VS_BOT) {
      await this.progressService.consumeEnergyForGame(player1Id, type);
    }

    // Проверка энергии для player2, если он есть
    if (player2Id && type !== GameType.VS_BOT) {
      await this.progressService.consumeEnergyForGame(player2Id, type);
    }

    const rngSeed = crypto.randomBytes(32).toString('hex');
    const rngHash = crypto.createHash('sha256').update(rngSeed).digest('hex');

    const engine = mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    const initialState = engine.createInitialState();

    const game = this.gamesRepository.create({
      player1Id,
      player2Id,
      mode,
      type,
      status: player2Id ? GameStatus.IN_PROGRESS : GameStatus.WAITING,
      gameState: initialState,
      rngSeed,
      rngHash,
      currentPlayer: 0,
      moveTimeLimit: 60000,
    });

    return this.gamesRepository.save(game);
  }

  async findOne(id: string): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id },
      relations: ['player1', 'player2', 'moves'],
    });
    if (!game) {
      throw new NotFoundException('Игра не найдена');
    }
    return game;
  }

  async rollDice(gameId: string, playerId: string): Promise<number[]> {
    const game = await this.findOne(gameId);
    
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Игра не активна');
    }

    const currentPlayerId = game.currentPlayer === 0 ? game.player1Id : game.player2Id;
    if (currentPlayerId !== playerId) {
      throw new BadRequestException('Не ваш ход');
    }

    const engine = game.mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    const dice = engine.rollDice(game.rngSeed + game.moves.length);
    
    game.gameState.dice = dice;
    game.lastMoveAt = new Date();
    await this.gamesRepository.save(game);

    return dice;
  }

  async makeMove(
    gameId: string,
    playerId: string,
    moves: Array<{ from: number; to: number; die: number }>,
  ): Promise<Game> {
    const game = await this.findOne(gameId);

    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Игра не активна');
    }

    const currentPlayerId = game.currentPlayer === 0 ? game.player1Id : game.player2Id;
    if (currentPlayerId !== playerId) {
      throw new BadRequestException('Не ваш ход');
    }

    const engine = game.mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    let currentState = game.gameState;

    for (const move of moves) {
      if (!engine.validateMove(currentState, move.from, move.to, move.die)) {
        throw new BadRequestException('Недопустимый ход');
      }
      currentState = engine.applyMove(currentState, move.from, move.to, move.die);
    }

    const moveNumber = game.moves.length + 1;
    const moveRecord = this.movesRepository.create({
      gameId: game.id,
      playerId,
      moveNumber,
      dice: game.gameState.dice,
      moves,
      gameStateBefore: game.gameState,
      gameStateAfter: currentState,
    });
    await this.movesRepository.save(moveRecord);

    currentState.dice = [];
    currentState.currentPlayer = currentState.currentPlayer === 0 ? 1 : 0;
    game.gameState = currentState;
    game.currentPlayer = currentState.currentPlayer;
    game.lastMoveAt = new Date();

    if (engine.isGameFinished(currentState)) {
      const winner = engine.getWinner(currentState);
      game.status = GameStatus.FINISHED;
      game.winnerId = winner === 0 ? game.player1Id : game.player2Id;
      if (winner === 0) {
        game.player1Score = 1;
      } else {
        game.player2Score = 1;
      }

      // Применяем логику после завершения игры
      await this.onGameFinished(game);
    }

    return this.gamesRepository.save(game);
  }

  /**
   * Обработка завершения игры: жизни, рейтинги, награды
   */
  private async onGameFinished(game: Game): Promise<void> {
    const loserId = game.winnerId === game.player1Id ? game.player2Id : game.player1Id;
    
    // Только для игр с реальными игроками применяем жизни
    if (game.type === GameType.VS_PLAYER && loserId) {
      await this.progressService.loseLifeOnDefeat(loserId);
    }

    // Обновление рейтингов (если RatingsService подключен)
    if (game.type === GameType.VS_PLAYER && game.mode && game.winnerId && loserId) {
      try {
        await this.ratingsService.updateRatings(
          game.winnerId,
          loserId,
          game.mode,
          false,
        );
      } catch (error) {
        // Игнорируем ошибки рейтинга, чтобы не сломать завершение игры
        console.error('Error updating ratings:', error);
      }
    }
  }

  async createBotGame(playerId: string): Promise<Game> {
    return this.create(playerId, null, GameMode.LONG, GameType.VS_BOT);
  }

  async getGameState(gameId: string): Promise<any> {
    const game = await this.findOne(gameId);
    return {
      id: game.id,
      mode: game.mode,
      status: game.status,
      type: game.type,
      gameState: game.gameState,
      currentPlayer: game.currentPlayer,
      player1Id: game.player1Id,
      player2Id: game.player2Id,
      player1: game.player1,
      player2: game.player2,
      player1Score: game.player1Score,
      player2Score: game.player2Score,
      winnerId: game.winnerId,
    };
  }
}
