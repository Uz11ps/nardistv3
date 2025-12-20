import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameMode, GameStatus, GameType } from './game.entity';
import { GameMove } from './game-move.entity';
import { BackgammonEngine } from './game-engine/backgammon-engine';
import { LongBackgammonEngine } from './game-engine/long-backgammon-engine';
import { ProgressService } from '../progress/progress.service';
import { RatingsService } from '../ratings/ratings.service';
import { UsersService } from '../users/users.service';
import { BotService } from '../bot/bot.service';
import { GamesGateway } from './games.gateway';
import * as crypto from 'crypto';

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

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
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    @Inject(forwardRef(() => BotService))
    private botService: BotService,
    @Inject(forwardRef(() => GamesGateway))
    private gamesGateway: GamesGateway,
  ) {}

  async create(
    player1Id: string,
    player2Id: string | null,
    mode: GameMode,
    type: GameType,
    stake: number = 0,
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

    // Если игра на ставки, проверяем баланс и блокируем средства
    if (stake > 0 && type === GameType.VS_PLAYER) {
      const player1 = await this.usersService.findOne(player1Id);
      if (Number(player1.narCoin) < stake) {
        throw new BadRequestException('Недостаточно NAR-coin для ставки');
      }
      // Блокируем ставку (вычитаем сразу, вернем проигравшему позже при завершении)
      const player1Balance = Number(player1.narCoin);
      const newPlayer1Balance = player1Balance - stake;
      await this.usersService.update(player1Id, { narCoin: newPlayer1Balance });

      if (player2Id) {
        const player2 = await this.usersService.findOne(player2Id);
        const player2Balance = Number(player2.narCoin);
        if (player2Balance < stake) {
          // Возвращаем деньги player1
          await this.usersService.update(player1Id, { narCoin: player1Balance });
          throw new BadRequestException('У противника недостаточно NAR-coin для ставки');
        }
        const newPlayer2Balance = player2Balance - stake;
        await this.usersService.update(player2Id, { narCoin: newPlayer2Balance });
      }
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
      stake,
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
    
    if (game.status !== GameStatus.IN_PROGRESS && game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Игра не активна');
    }

    const currentPlayerId = game.currentPlayer === 0 ? game.player1Id : game.player2Id;
    // For bot games, player2Id is null, so we skip the check if it's a bot turn
    const isBotTurn = game.type === GameType.VS_BOT && game.player2Id === null && game.currentPlayer === 1;
    if (!isBotTurn && currentPlayerId !== playerId) {
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

    // Разрешаем ход если игра в ожидании или в процессе
    if (game.status !== GameStatus.IN_PROGRESS && game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Игра не активна');
    }

    const currentPlayerId = game.currentPlayer === 0 ? game.player1Id : game.player2Id;
    // For bot games, player2Id is null, so we skip the check if it's a bot turn
    const isBotTurn = game.type === GameType.VS_BOT && game.player2Id === null && game.currentPlayer === 1;
    if (!isBotTurn && currentPlayerId !== playerId) {
      throw new BadRequestException('Не ваш ход');
    }

    if (!game.gameState.dice || game.gameState.dice.length === 0) {
      throw new BadRequestException('Сначала бросьте кубики');
    }

    const engine = game.mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    const dice = game.gameState.dice;

    // Проверяем валидность всех ходов
    let currentState = JSON.parse(JSON.stringify(game.gameState));
    const diceCopy = [...dice];

    for (const move of moves) {
      console.log(`🔍 Валидация хода: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
      const isValid = engine.validateMove(currentState, move.from, move.to, move.die);
      console.log(`  Результат валидации: ${isValid ? '✅ валиден' : '❌ невалиден'}`);
      
      if (!isValid) {
        console.error(`❌ Ход отклонен: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
        throw new BadRequestException(`Недопустимый ход: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
      }
      
      // Удаляем использованный кубик
      const dieIndex = diceCopy.indexOf(move.die);
      if (dieIndex === -1) {
        console.error(`❌ Кубик ${move.die} уже использован или недоступен. Доступные кубики:`, diceCopy);
        throw new BadRequestException(`Кубик ${move.die} уже использован или недоступен`);
      }
      diceCopy.splice(dieIndex, 1);
      
      console.log(`✅ Применяем ход: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
      currentState = engine.applyMove(currentState, move.from, move.to, move.die);
      console.log(`  Состояние после хода:`, {
        points: currentState.points,
        bar: currentState.bar,
        borneOff: currentState.borneOff,
      });
    }

    // Проверяем обязательность использования всех кубиков, если это возможно
    // getAllValidMoves доступен только для BackgammonEngine
    let allValidMoves: Array<Array<{ from: number; to: number; die: number }>> = [];
    if ('getAllValidMoves' in engine && typeof engine.getAllValidMoves === 'function') {
      allValidMoves = engine.getAllValidMoves(game.gameState, dice);
    }
    
    // Проверяем, что использованы правильные кубики (правильное количество каждого)
    const diceCount = new Map<number, number>();
    for (const die of dice) {
      diceCount.set(die, (diceCount.get(die) || 0) + 1);
    }

    const usedCount = new Map<number, number>();
    for (const move of moves) {
      usedCount.set(move.die, (usedCount.get(move.die) || 0) + 1);
    }

    // Проверяем, не превышено ли использование кубиков
    for (const [die, used] of usedCount.entries()) {
      const available = diceCount.get(die) || 0;
      if (used > available) {
        throw new BadRequestException(`Кубик ${die} использован ${used} раз(а), но доступно только ${available}`);
      }
    }
    
    // Проверяем обязательность использования всех кубиков только если это длинные нарды
    // В длинных нардах можно делать ходы по одному, если это валидно
    if (game.mode === GameMode.LONG && allValidMoves.length > 0) {
      // Проверяем, есть ли ходы, которые используют все кубики
      const fullMoves = allValidMoves.filter((moveSeq) => moveSeq.length === dice.length);
      
      // В длинных нардах разрешаем делать один ход за раз, если он валиден
      // Но если есть возможность использовать все кубики и пользователь использует только один - предупреждаем
      if (fullMoves.length > 0 && moves.length < dice.length) {
        console.log(`⚠️ Пользователь использует только ${moves.length} из ${dice.length} кубиков, но есть возможность использовать все`);
        // Разрешаем, но не требуем использовать все кубики в длинных нардах
        // Пользователь может сделать второй ход позже
      }
    } else if (allValidMoves.length > 0) {
      // Для коротких нард требуем использовать все кубики, если это возможно
      const fullMoves = allValidMoves.filter((moveSeq) => moveSeq.length === dice.length);
      
      if (fullMoves.length > 0 && moves.length < dice.length) {
        throw new BadRequestException(
          `Необходимо использовать все кубики. Доступно ${dice.length} кубиков (${dice.join(', ')}), использовано ${moves.length}. Доступны ходы, использующие все кубики.`
        );
      }
    }

    const moveNumber = game.moves.length + 1;
    const moveRecord = this.movesRepository.create({
      gameId: game.id,
      playerId,
      moveNumber,
      dice: dice,
      moves,
      gameStateBefore: game.gameState,
      gameStateAfter: currentState,
    });
    await this.movesRepository.save(moveRecord);

    currentState.dice = [];
    currentState.currentPlayer = currentState.currentPlayer === 0 ? 1 : 0;
    // Reset movesFromHead for the new player's turn
    currentState.movesFromHead = 0;
    game.gameState = currentState;
    game.currentPlayer = currentState.currentPlayer;
    game.lastMoveAt = new Date();

    // Если это первый ход (игра в статусе WAITING), переводим в IN_PROGRESS
    if (game.status === GameStatus.WAITING) {
      game.status = GameStatus.IN_PROGRESS;
    }

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

    const savedGame = await this.gamesRepository.save(game);

    // Если следующий игрок - бот, делаем автоматический ход
    // В играх с ботом player2Id === null означает что бот это player2
    if (game.type === GameType.VS_BOT && savedGame.status === GameStatus.IN_PROGRESS && savedGame.player2Id === null) {
      // Если следующий ход бота (currentPlayer === 1 означает что бот ходит)
      if (savedGame.currentPlayer === 1) {
        // Бросаем кубики для бота и делаем ход
        setTimeout(async () => {
          try {
            const botGame = await this.findOne(savedGame.id);
            if (botGame.status === GameStatus.FINISHED) return;
            
            // Бросаем кубики для бота (используем player1Id для bypass, but isBotTurn check will allow it)
            const botDice = await this.rollDice(savedGame.id, botGame.player1Id);
            
            // Emit dice rolled event for bot
            const gameStateAfterDice = await this.getGameState(savedGame.id);
            if (this.gamesGateway?.server) {
              this.gamesGateway.server.to(`game:${savedGame.id}`).emit('dice_rolled', { 
                dice: botDice, 
                playerId: null // Bot has no player ID
              });
              this.gamesGateway.server.to(`game:${savedGame.id}`).emit('game_state', gameStateAfterDice);
            }
            
            // Ждем немного и делаем ход бота
            setTimeout(async () => {
              try {
                const updatedGame = await this.findOne(savedGame.id);
                if (updatedGame.status === GameStatus.FINISHED) return;
                
                const botMoves = await this.botService.makeBotMove(updatedGame.gameState, updatedGame.mode);
                if (botMoves.length > 0) {
                  // Use player1Id for bot moves (isBotTurn check will allow it)
                  await this.makeMove(savedGame.id, botGame.player1Id, botMoves);
                  
                  // Emit move_made event for bot
                  const gameStateAfterMove = await this.getGameState(savedGame.id);
                  if (this.gamesGateway?.server) {
                    this.gamesGateway.server.to(`game:${savedGame.id}`).emit('move_made', gameStateAfterMove);
                    
                    // Check if game finished
                    const finalGame = await this.findOne(savedGame.id);
                    if (finalGame.status === GameStatus.FINISHED) {
                      this.gamesGateway.server.to(`game:${savedGame.id}`).emit('game_finished', {
                        winnerId: finalGame.winnerId,
                        player1Score: finalGame.player1Score,
                        player2Score: finalGame.player2Score,
                        gameState: gameStateAfterMove,
                      });
                    }
                  }
                }
              } catch (error) {
                this.logger.error(`Bot move error: ${error.message}`, error.stack);
              }
            }, 1500);
          } catch (error) {
            this.logger.error(`Bot dice roll error: ${error.message}`, error.stack);
          }
        }, 1000); // Задержка 1 секунда для визуализации
      }
    }

    return savedGame;
  }

  /**
   * Получить все возможные ходы для текущей позиции
   */
  async getPossibleMoves(gameId: string, playerId: string): Promise<Array<Array<{ from: number; to: number; die: number }>>> {
    const game = await this.findOne(gameId);

    if (game.status !== GameStatus.IN_PROGRESS && game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Игра не активна');
    }

    const currentPlayerId = game.currentPlayer === 0 ? game.player1Id : game.player2Id;
    if (currentPlayerId !== playerId) {
      throw new BadRequestException('Не ваш ход');
    }

    if (!game.gameState.dice || game.gameState.dice.length === 0) {
      return [];
    }

    const engine = game.mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    
    // getAllValidMoves доступен только для BackgammonEngine
    if ('getAllValidMoves' in engine && typeof engine.getAllValidMoves === 'function') {
      return engine.getAllValidMoves(game.gameState, game.gameState.dice);
    }
    
    // Для LongBackgammonEngine возвращаем пустой массив (можно будет реализовать позже)
    return [];
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

    // Обработка ставок
    if (game.stake > 0 && game.type === GameType.VS_PLAYER && game.winnerId && loserId) {
      const stake = Number(game.stake);
      
      // Победитель получает обе ставки (с учетом комиссии)
      const winner = await this.usersService.findOne(game.winnerId);
      const totalPot = stake * 2;
      const baseCommission = Math.floor(totalPot * 0.05); // 5% комиссия
      
      // Применяем снижение комиссии через экономику
      const winnerUser = await this.usersService.findOne(game.winnerId);
      const economyLevel = winnerUser.enhancement === 'economy' ? 1 : 0; // TODO: получить уровень экономики
      const finalCommission = this.progressService.calculateFeeWithEconomy(baseCommission, economyLevel);
      const winnerReward = totalPot - finalCommission;

      const winnerBalance = Number(winner.narCoin);
      const newWinnerBalance = winnerBalance + winnerReward;
      await this.usersService.update(game.winnerId, { narCoin: newWinnerBalance });
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

  /**
   * Сдача игры игроком
   */
  async resignGame(gameId: string, playerId: string): Promise<Game> {
    const game = await this.findOne(gameId);
    
    if (game.status === GameStatus.FINISHED) {
      throw new BadRequestException('Игра уже завершена');
    }

    if (game.player1Id !== playerId && game.player2Id !== playerId) {
      throw new BadRequestException('Вы не участник этой игры');
    }

    // Определяем победителя (противник сдавшегося игрока)
    const winnerId = game.player1Id === playerId ? game.player2Id : game.player1Id;
    
    if (!winnerId) {
      throw new BadRequestException('Невозможно сдать игру без противника');
    }

    // Завершаем игру
    game.status = GameStatus.FINISHED;
    game.winnerId = winnerId;
    
    if (winnerId === game.player1Id) {
      game.player1Score = 1;
      game.player2Score = 0;
    } else {
      game.player1Score = 0;
      game.player2Score = 1;
    }

    const savedGame = await this.gamesRepository.save(game);

    // Применяем логику после завершения игры
    await this.onGameFinished(savedGame);

    return savedGame;
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
