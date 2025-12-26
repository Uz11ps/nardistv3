import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Game, GameMode, GameStatus, GameType } from './game.entity';
import { GameMove } from './game-move.entity';
import { PlayerMatchHistory } from './player-match-history.entity';
import { BackgammonEngine } from './game-engine/backgammon-engine';
import { LongBackgammonEngine } from './game-engine/long-backgammon-engine';
import { ProgressService } from '../progress/progress.service';
import { XpCalculatorService } from '../progress/xp-calculator.service';
import { RatingsService } from '../ratings/ratings.service';
import { UsersService } from '../users/users.service';
import { BotService } from '../bot/bot.service';
import { SkinsService } from '../skins/skins.service';
import { QuestsService } from '../quests/quests.service';
import { QuestTarget } from '../quests/quest.entity';
import { TrainingService } from '../training/training.service';
import { TaskType } from '../training/training-task.entity';
import { TournamentsService } from '../tournaments/tournaments.service';
import * as crypto from 'crypto';

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameMove)
    private movesRepository: Repository<GameMove>,
    @InjectRepository(PlayerMatchHistory)
    private matchHistoryRepository: Repository<PlayerMatchHistory>,
    private backgammonEngine: BackgammonEngine,
    private longBackgammonEngine: LongBackgammonEngine,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
    @Inject(forwardRef(() => XpCalculatorService))
    private xpCalculator: XpCalculatorService,
    @Inject(forwardRef(() => RatingsService))
    private ratingsService: RatingsService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    @Inject(forwardRef(() => BotService))
    private botService: BotService,
    @Inject(forwardRef(() => SkinsService))
    private skinsService: SkinsService,
    @Inject(forwardRef(() => QuestsService))
    private questsService: QuestsService,
    @Inject(forwardRef(() => TrainingService))
    private trainingService: TrainingService,
    @Inject(forwardRef(() => TournamentsService))
    private tournamentsService: TournamentsService,
  ) {}

  async create(
    player1Id: string,
    player2Id: string | null,
    mode: GameMode,
    type: GameType,
    stake: number = 0,
    moveTimeLimit: number = 60000,
  ): Promise<Game> {
    // Проверяем, не находится ли player1 уже в активной игре (исключаем finished, abandoned и игры с ботом)
    const player1ActiveGames = await this.gamesRepository.find({
      where: [
        { player1Id, status: GameStatus.WAITING },
        { player1Id, status: GameStatus.IN_PROGRESS },
        { player2Id: player1Id, status: GameStatus.WAITING },
        { player2Id: player1Id, status: GameStatus.IN_PROGRESS },
      ],
    });
    // Фильтруем только действительно активные игры (исключаем игры с ботом)
    const trulyActivePlayer1Games = player1ActiveGames.filter(game => 
      (game.status === GameStatus.WAITING || game.status === GameStatus.IN_PROGRESS) &&
      game.type !== GameType.VS_BOT
    );
    if (trulyActivePlayer1Games.length > 0) {
      throw new BadRequestException('Вы уже находитесь в активной игре. Завершите текущую игру перед созданием новой.');
    }

    // Проверяем, не находится ли player2 уже в активной игре (если указан)
    if (player2Id) {
      const player2ActiveGames = await this.gamesRepository.find({
        where: [
          { player1Id: player2Id, status: GameStatus.WAITING },
          { player1Id: player2Id, status: GameStatus.IN_PROGRESS },
          { player2Id, status: GameStatus.WAITING },
          { player2Id, status: GameStatus.IN_PROGRESS },
        ],
      });
      // Фильтруем только действительно активные игры (исключаем игры с ботом)
      const trulyActivePlayer2Games = player2ActiveGames.filter(game => 
        (game.status === GameStatus.WAITING || game.status === GameStatus.IN_PROGRESS) &&
        game.type !== GameType.VS_BOT
      );
      if (trulyActivePlayer2Games.length > 0) {
        throw new BadRequestException('Соперник уже находится в активной игре.');
      }
    }

    // Проверка энергии для player1 (бот-игры не тратят энергию)
    // Энергия - основной ресурс для начала игры
    // Проверяем энергию ДО создания игры, но тратим ПОСЛЕ успешного создания
    let player1EnergyChecked = false;
    let player2EnergyChecked = false;
    
    // Проверяем энергию перед созданием игры (проверяем максимальный возможный расход)
    const isTournament = type === GameType.TOURNAMENT;
    if (type === GameType.VS_PLAYER || type === GameType.TOURNAMENT) {
      await this.progressService.checkEnergyForGame(player1Id, type, isTournament);
      player1EnergyChecked = true;
      
      if (player2Id) {
        await this.progressService.checkEnergyForGame(player2Id, type, isTournament);
        player2EnergyChecked = true;
      }
    }

    // Если игра на ставки, проверяем баланс и блокируем средства
    if (stake > 0 && type === GameType.VS_PLAYER) {
      const player1 = await this.usersService.findOne(player1Id);
      const player1Balance = Number(player1.narCoin);
      if (player1Balance < stake) {
        throw new BadRequestException('Недостаточно NAR-coin для ставки');
      }
      // Блокируем ставку (вычитаем сразу, вернем проигравшему позже при завершении)
      const newPlayer1Balance = player1Balance - stake;
      await this.usersService.update(player1Id, { narCoin: newPlayer1Balance });
      this.logger.log(`💰 Ставка списана у игрока ${player1Id}: -${stake} NAR (было ${player1Balance}, стало ${newPlayer1Balance})`);

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
        this.logger.log(`💰 Ставка списана у игрока ${player2Id}: -${stake} NAR (было ${player2Balance}, стало ${newPlayer2Balance})`);
      }
    }

    const rngSeed = crypto.randomBytes(32).toString('hex');
    const verificationSalt = crypto.randomBytes(16).toString('hex');
    
    // Генерация последовательностей бросков (по 1000 для каждого)
    const generateRolls = () => {
      const rolls = [];
      for (let i = 0; i < 1000; i++) {
        rolls.push([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1
        ]);
      }
      return rolls;
    };

    const p1Rolls = generateRolls();
    const p2Rolls = generateRolls();

    // Хешируем последовательности для контроля честности
    const p1Hash = crypto.createHash('sha256').update(JSON.stringify(p1Rolls) + verificationSalt).digest('hex');
    const p2Hash = crypto.createHash('sha256').update(JSON.stringify(p2Rolls) + verificationSalt).digest('hex');
    const rngHash = JSON.stringify({ p1Hash, p2Hash });

    const engine = mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    const initialState = engine.createInitialState();

    // Загружаем выбранные скины игроков
    const player1Skins = await this.skinsService.getSelectedSkin(player1Id);
    const player2Skins = player2Id ? await this.skinsService.getSelectedSkin(player2Id) : null;

    // Сохраняем ID скинов в skinData
    const skinData: any = {
      player1: {
        board: player1Skins.board?.id,
        dice: player1Skins.dice?.id,
        checkers: player1Skins.checkers?.id,
      },
    };

    if (player2Skins) {
      skinData.player2 = {
        board: player2Skins.board?.id,
        dice: player2Skins.dice?.id,
        checkers: player2Skins.checkers?.id,
      };
    }

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
      p1Rolls,
      p2Rolls,
      verificationSalt,
      p1Offset: 1,
      p2Offset: 1,
      currentPlayer: 0,
      moveTimeLimit: moveTimeLimit,
      skinData,
    });

    // Сохраняем игру в БД
    const savedGame = await this.gamesRepository.save(game);

    // Энергия теперь тратится при завершении матча, а не при создании
    // Проверка энергии оставлена для валидации перед созданием игры

    return savedGame;
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

  async getGameSkins(gameId: string): Promise<any> {
    const game = await this.findOne(gameId);
    
    if (!game.skinData) {
      // Если скины не сохранены, загружаем текущие выбранные скины игроков
      const player1Skins = await this.skinsService.getSelectedSkin(game.player1Id);
      const player2Skins = game.player2Id ? await this.skinsService.getSelectedSkin(game.player2Id) : null;
      
      return {
        player1: {
          board: player1Skins.board,
          dice: player1Skins.dice,
          checkers: player1Skins.checkers,
        },
        player2: player2Skins ? {
          board: player2Skins.board,
          dice: player2Skins.dice,
          checkers: player2Skins.checkers,
        } : null,
      };
    }

    // Загружаем полные данные скинов по ID через SkinsService
    const result: any = {
      player1: {},
      player2: null,
    };

    // Вспомогательная функция для загрузки скина по ID
    const loadSkinById = async (skinId: string) => {
      if (!skinId) return null;
      try {
        const allSkins = await this.skinsService.getAllSkins();
        return allSkins.find(s => s.id === skinId) || null;
      } catch {
        return null;
      }
    };

    if (game.skinData.player1) {
      if (game.skinData.player1.board) {
        result.player1.board = await loadSkinById(game.skinData.player1.board);
      }
      if (game.skinData.player1.dice) {
        result.player1.dice = await loadSkinById(game.skinData.player1.dice);
      }
      if (game.skinData.player1.checkers) {
        result.player1.checkers = await loadSkinById(game.skinData.player1.checkers);
      }
    }

    if (game.skinData.player2) {
      result.player2 = {};
      if (game.skinData.player2.board) {
        result.player2.board = await loadSkinById(game.skinData.player2.board);
      }
      if (game.skinData.player2.dice) {
        result.player2.dice = await loadSkinById(game.skinData.player2.dice);
      }
      if (game.skinData.player2.checkers) {
        result.player2.checkers = await loadSkinById(game.skinData.player2.checkers);
      }
    }

    // Если скины не найдены, используем дефолтные
    const defaultSkins = await this.skinsService.getAllSkins();
    const defaultBoard = defaultSkins.find(s => s.type === 'board' && s.isDefault);
    const defaultDice = defaultSkins.find(s => s.type === 'dice' && s.isDefault);
    const defaultCheckers = defaultSkins.find(s => s.type === 'checkers' && s.isDefault);

    if (!result.player1.board) result.player1.board = defaultBoard;
    if (!result.player1.dice) result.player1.dice = defaultDice;
    if (!result.player1.checkers) result.player1.checkers = defaultCheckers;

    if (result.player2) {
      if (!result.player2.board) result.player2.board = defaultBoard;
      if (!result.player2.dice) result.player2.dice = defaultDice;
      if (!result.player2.checkers) result.player2.checkers = defaultCheckers;
    }

    return result;
  }

  /**
   * Получает все активные игры в статусе IN_PROGRESS для проверки таймаутов
   * Исключает игры с ботом
   */
  async getActiveInProgressGames(): Promise<Game[]> {
    try {
      // Проверяем, что репозиторий инициализирован
      if (!this.gamesRepository) {
        this.logger.warn('gamesRepository is not initialized');
        return [];
      }
      
      return await this.gamesRepository.find({
        where: { 
          status: GameStatus.IN_PROGRESS,
          type: GameType.VS_PLAYER, // Исключаем игры с ботом
        },
        relations: [], // Не загружаем relations для производительности
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      const errorStack = error?.stack || 'No stack trace';
      
      this.logger.error(`Error fetching active in-progress games: ${errorMessage}`);
      this.logger.debug(`Error stack: ${errorStack}`);
      
      return []; // Возвращаем пустой массив при ошибке
    }
  }

  /**
   * Получить активную игру пользователя (только IN_PROGRESS, исключая игры с ботом)
   */
  async getActiveGame(userId: string): Promise<Game | null> {
    try {
      const activeGames = await this.gamesRepository.find({
        where: [
          { player1Id: userId, status: GameStatus.IN_PROGRESS },
          { player2Id: userId, status: GameStatus.IN_PROGRESS },
          { player1Id: userId, status: GameStatus.WAITING },
          { player2Id: userId, status: GameStatus.WAITING },
        ],
        // Не загружаем relations, чтобы избежать проблем с сериализацией
        relations: [],
      });

      // Фильтруем только действительно активные игры (исключаем игры с ботом)
      const trulyActiveGames = activeGames.filter(game => 
        (game.status === GameStatus.IN_PROGRESS || game.status === GameStatus.WAITING) &&
        game.type !== GameType.VS_BOT
      );

      if (trulyActiveGames.length > 0) {
        return trulyActiveGames[0];
      }

      return null;
    } catch (error) {
      this.logger.error(`❌ Ошибка при получении активной игры для пользователя ${userId}:`, error);
      throw error;
    }
  }

  async rollDice(gameId: string, playerId: string | null, skipPlayerCheck: boolean = false): Promise<number[]> {
    const game = await this.findOne(gameId);
    
    if (game.status !== GameStatus.IN_PROGRESS && game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Игра не активна');
    }

    // Пропускаем проверку игрока только при начальном броске (skipPlayerCheck = true)
    if (!skipPlayerCheck) {
      const currentPlayerId = game.currentPlayer === 0 ? game.player1Id : game.player2Id;
      // For bot games, player2Id is null, so we skip the check if it's a bot turn
      const isBotTurn = game.type === GameType.VS_BOT && game.player2Id === null && game.currentPlayer === 1;
      if (!isBotTurn && currentPlayerId !== playerId) {
        throw new BadRequestException('Не ваш ход');
      }
    }

    const engine = game.mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    
    // Контроль честности: выбираем бросок из последовательности
    const isPlayer1 = playerId === game.player1Id;
    const playerRolls = isPlayer1 ? game.p1Rolls : game.p2Rolls;
    const myOffset = isPlayer1 ? game.p1Offset : game.p2Offset;
    const opponentOffset = isPlayer1 ? game.p2Offset : game.p1Offset;
    
    // Формула: (Смещение игрока - 1) * 2 + Смещение соперника
    const startIdx = ((myOffset || 1) - 1) * 2 + (opponentOffset || 1);
    
    // Номер текущего броска для этого игрока
    const playerMovesCount = (game.moves || []).filter(m => m.playerId === playerId).length;
    const currentRollIdx = (startIdx + playerMovesCount) % (playerRolls?.length || 1000);
    
    const diceRoll = playerRolls ? playerRolls[currentRollIdx] : engine.rollDice(game.rngSeed + (game.moves?.length || 0));
    
    console.log(`🎲 Provably Fair Dice: player=${isPlayer1 ? 'P1' : 'P2'}, startIdx=${startIdx}, rollIdx=${currentRollIdx}, roll=[${diceRoll.join(', ')}]`);
    
    console.log(`🎲 rollDice called: gameId=${gameId}, mode=${game.mode}, diceRoll=[${diceRoll.join(', ')}]`);
    
    // В обох режимах дубль дает 4 хода
    let dice: number[];
    const isDoubles = diceRoll.length === 2 && diceRoll[0] === diceRoll[1];
    
    if (isDoubles) {
      // Doubles: expand to 4 moves
      dice = [diceRoll[0], diceRoll[0], diceRoll[0], diceRoll[0]];
      console.log(`✅ Doubles detected (${diceRoll[0]}-${diceRoll[1]}), expanded to 4 moves: [${dice.join(', ')}]`);
    } else {
      dice = diceRoll;
    }
    
    game.gameState.dice = dice;
    game.lastMoveAt = new Date();
    const savedGame = await this.gamesRepository.save(game);
    
    console.log(`💾 Saved game.gameState.dice: [${savedGame.gameState.dice.join(', ')}]`);

    return dice;
  }

  async makeMove(
    gameId: string,
    playerId: string | null,
    moves: Array<{ from: number; to: number; die: number }>,
  ): Promise<Game> {
    if (!gameId) {
      this.logger.error(`makeMove called with null/undefined gameId! playerId: ${playerId}`);
      throw new BadRequestException('ID игры не указан');
    }

    const game = await this.findOne(gameId);
    
    // Проверяем что game.id существует сразу после загрузки
    if (!game || !game.id) {
      this.logger.error(`Game not found or missing ID! gameId param: ${gameId}, game object:`, game ? JSON.stringify({ id: game.id, status: game.status }, null, 2) : 'null');
      throw new BadRequestException('Игра не найдена или ID игры отсутствует');
    }

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
    
    // Определяем, является ли этот ход первым в игре для этого режима (Long)
    // Правило Минспорта 20.3: только второй игрок (черные) при первом ходе с дублями 3:3, 4:4 или 6:6 может снять 2 шашки с головы
    const isFirstMoveOfGame = game.mode === GameMode.LONG && (game.moves || []).length < 2;

    // Проверяем валидность всех ходов
    let currentState = JSON.parse(JSON.stringify(game.gameState));
    const diceCopy = [...dice];

    // Разворачиваем комбинированные ходы (те, у которых есть steps) в последовательность обычных
    const expandedMoves = [];
    for (const move of moves) {
      if ((move as any).steps && Array.isArray((move as any).steps)) {
        expandedMoves.push(...(move as any).steps);
      } else {
        expandedMoves.push(move);
      }
    }

    for (const move of expandedMoves) {
      console.log(`🔍 Валидация хода: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
      console.log(`  Текущее состояние: movesFromHead=${currentState.movesFromHead || 0}, dice=[${currentState.dice?.join(', ') || 'none'}]`);
      
      const isValid = (engine as any).validateMove(currentState, move.from, move.to, move.die, isFirstMoveOfGame);
      
      if (!isValid) {
        // Логируем для отладки
        this.logger.error(`❌ Ход отклонен движком: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
        this.logger.error(`  Текущий игрок: ${currentState.currentPlayer}, режим: ${game.mode}`);
        this.logger.error(`  Доступные кубики: [${currentState.dice?.join(', ') || 'none'}]`);
        
        // Для коротких нард вычисляем правильный die для этого расстояния
        let expectedDieMsg = '';
        if (game.mode === GameMode.SHORT) {
          const expectedDie = currentState.currentPlayer === 0 ? (move.to - move.from) : (move.from - move.to);
          expectedDieMsg = ` Для этого расстояния нужен кубик ${expectedDie}.`;
        }
        
        throw new BadRequestException(`Недопустимый ход: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}.${expectedDieMsg} Доступные кубики: [${currentState.dice?.join(', ') || 'none'}]`);
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
    }

    // Для целей сохранения и истории используем развернутые ходы
    const finalMovesToSave = expandedMoves;

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
    for (const move of finalMovesToSave) {
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
      if (fullMoves.length > 0 && finalMovesToSave.length < dice.length) {
        console.log(`⚠️ Пользователь использует только ${finalMovesToSave.length} из ${dice.length} кубиков, но есть возможность использовать все`);
        // Разрешаем, но не требуем использовать все кубики в длинных нардах
        // Пользователь может сделать второй ход позже
      }
    }
    // Убрана проверка на обязательное использование всех кубиков
    // Теперь разрешаем подтверждение частичных ходов в коротких нардах
    // Оставшиеся кубики будут обработаны как отдельный ход после подтверждения

    const moveNumber = (game.moves?.length || 0) + 1;
    
    // Используем gameId параметр напрямую для надежности
    const finalGameId = game.id || gameId;
    if (!finalGameId) {
      this.logger.error(`Game ID is missing! gameId param: ${gameId}, game.id: ${game.id}, game object keys:`, Object.keys(game));
      throw new BadRequestException('Ошибка: ID игры не найден');
    }
    
    this.logger.log(`Saving move: gameId=${finalGameId}, playerId=${playerId}, moveNumber=${moveNumber}, moves count=${finalMovesToSave.length}`);
    
    // Используем raw SQL через queryRunner чтобы полностью избежать проблем с relations
    try {
      const queryRunner = this.movesRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      
      const moveId = await queryRunner.manager.query(
        `INSERT INTO game_moves ("gameId", "playerId", "moveNumber", dice, moves, "gameStateBefore", "gameStateAfter")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          finalGameId,
          playerId,
          moveNumber,
          JSON.stringify(dice),
          JSON.stringify(finalMovesToSave),
          JSON.stringify(game.gameState),
          JSON.stringify(currentState),
        ]
      );
      
      await queryRunner.release();
      
      const savedMoveId = moveId[0].id;
      this.logger.log(`Move saved successfully: moveId=${savedMoveId}, gameId=${finalGameId}`);
    } catch (error) {
      this.logger.error(`Failed to save move:`, error);
      this.logger.error(`Move record data before insert:`, {
        gameId: finalGameId,
        playerId: playerId,
        moveNumber: moveNumber,
        dice: dice,
        movesCount: finalMovesToSave.length
      });
      throw error;
    }

    // Calculate remaining dice after moves
    const remainingDice = diceCopy;
    
    if (remainingDice.length === 0) {
      // Все кубики использованы - смена хода
      currentState.dice = [];
      currentState.currentPlayer = currentState.currentPlayer === 0 ? 1 : 0;
      currentState.movesFromHead = 0;
      currentState.movesFromPoint = {};
      this.logger.log(`🔄 Turn switched: all dice used. New player: ${currentState.currentPlayer}`);
    } else {
      // Проверяем, есть ли валидные ходы с оставшимися кубиками
      let hasValidMoves = false;
      if ('getAllValidMoves' in engine && typeof engine.getAllValidMoves === 'function') {
        const remainingMoves = engine.getAllValidMoves(currentState, remainingDice);
        // getAllValidMoves возвращает последовательности. Если есть хотя бы одна непустая - ходы есть.
        hasValidMoves = remainingMoves.length > 0 && remainingMoves.some(seq => seq.length > 0);
        this.logger.log(`🔍 Checking remaining moves: dice=[${remainingDice.join(', ')}], hasValidMoves=${hasValidMoves}`);
      }
      
      if (hasValidMoves) {
        // Есть еще ходы - оставляем того же игрока
        // После подтверждения части дубля (если использовано 2 из 4), оставшиеся 2 кубика обрабатываются как обычный ход
        currentState.dice = remainingDice;
        this.logger.log(`🟡 Keeping same player: valid moves remain with dice [${remainingDice.join(', ')}]`);
      } else {
        // Ходов больше нет - принудительная смена хода
        currentState.dice = [];
        currentState.currentPlayer = currentState.currentPlayer === 0 ? 1 : 0;
        currentState.movesFromHead = 0;
        currentState.movesFromPoint = {};
        this.logger.log(`🔄 Turn switched: no valid moves remain with [${remainingDice.join(', ')}]. New player: ${currentState.currentPlayer}`);
      }
    }
    
    // Перезагружаем игру чтобы TypeORM знал о новом ходе и не пытался синхронизировать relations
    const updatedGame = await this.findOne(gameId);
    updatedGame.gameState = currentState;
    updatedGame.currentPlayer = currentState.currentPlayer;
    updatedGame.lastMoveAt = new Date();

    // Если это первый ход (игра в статусе WAITING), переводим в IN_PROGRESS
    if (updatedGame.status === GameStatus.WAITING) {
      updatedGame.status = GameStatus.IN_PROGRESS;
    }

    if (engine.isGameFinished(currentState)) {
      const winner = engine.getWinner(currentState);
      updatedGame.status = GameStatus.FINISHED;
      updatedGame.winnerId = winner === 0 ? updatedGame.player1Id : updatedGame.player2Id;
      
      // Применяем износ экипировки после завершения игры (Equipment Spec v2.0)
      try {
        const isTournament = updatedGame.type === GameType.TOURNAMENT;
        
        // Для игрока 1: применяем износ ко всем PER_MATCH предметам (BOARD, CHECKERS, CUP, CLOCK, CASE)
        await this.skinsService.applyWearToEquipmentAfterMatch(
          updatedGame.player1Id,
          null, // null = все PER_MATCH предметы
          isTournament,
        );
        
        // Для игрока 2 (если есть): применяем износ ко всем PER_MATCH предметам
        if (updatedGame.player2Id) {
          await this.skinsService.applyWearToEquipmentAfterMatch(
            updatedGame.player2Id,
            null,
            isTournament,
          );
        }
      } catch (error) {
        this.logger.error('Ошибка при применении износа экипировки:', error);
      }
      
      if (winner === 0) {
        updatedGame.player1Score = 1;
      } else {
        updatedGame.player2Score = 1;
      }
    }

    const savedGame = await this.gamesRepository.save(updatedGame);

    // Применяем логику после завершения игры (после сохранения)
    if (savedGame.status === GameStatus.FINISHED) {
      await this.onGameFinished(savedGame);
    }

    // Bot moves are now handled by GamesGateway.handleBotTurnIfNeeded()
    // This avoids circular dependency issues

    return savedGame;
  }

  /**
   * Получить все возможные ходы для текущей позиции
   */
  async getPossibleMoves(
    gameId: string,
    playerId: string,
    pendingMoves?: Array<{ from: number; to: number; die: number }>,
  ): Promise<{
    allMoves: Array<Array<{ from: number; to: number; die: number }>>;
    movesFromPoint?: Array<{ from: number; to: number; die: number }>;
  }> {
    const game = await this.findOne(gameId);

    if (game.status !== GameStatus.IN_PROGRESS && game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Игра не активна');
    }

    const currentPlayerId = game.currentPlayer === 0 ? game.player1Id : game.player2Id;
    if (currentPlayerId !== playerId) {
      throw new BadRequestException('Не ваш ход');
    }

    const engine = game.mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    let state = game.gameState;
    
    // Проверяем, является ли это дублем (4 одинаковых кубика) и нет pendingMoves
    const originalDice = state.dice || [];
    const isDoubles = originalDice.length === 4 && originalDice.every(d => d === originalDice[0]);
    const hasPendingMoves = pendingMoves && pendingMoves.length > 0;

    // Применяем локальные ходы к состоянию перед расчетом возможных ходов
    let remainingDice = [...(state.dice || [])];
    if (hasPendingMoves) {
      // Создаем глубокую копию состояния для применения pendingMoves
      state = JSON.parse(JSON.stringify(state));
      
      for (const move of pendingMoves) {
        // Пытаемся найти кубик или комбинацию кубиков
        
        // 1. Если есть конкретные шаги, используем их
        if ((move as any).steps && Array.isArray((move as any).steps)) {
          for (const step of (move as any).steps) {
            const idx = remainingDice.indexOf(step.die);
            if (idx !== -1) {
              remainingDice.splice(idx, 1);
              state = engine.applyMove(state, step.from, step.to, step.die);
            }
          }
          continue;
        }

        // 2. Иначе ищем одиночный кубик
        let used = false;
        const dieIndex = remainingDice.indexOf(move.die);
        if (dieIndex !== -1) {
          remainingDice.splice(dieIndex, 1);
          used = true;
          state = engine.applyMove(state, move.from, move.to, move.die);
        } else if (game.mode === GameMode.LONG) {
          // 3. Или ищем сумму для длинных нард (fallback)
          for (let i = 0; i < remainingDice.length; i++) {
            for (let j = i + 1; j < remainingDice.length; j++) {
              if (remainingDice[i] + remainingDice[j] === move.die) {
                remainingDice.splice(j, 1);
                remainingDice.splice(i, 1);
                used = true;
                state = engine.applyMove(state, move.from, move.to, move.die);
                break;
              }
            }
            if (used) break;
          }
        }
        
        if (!used) {
          this.logger.warn(`⚠️ Не удалось найти кубик для хода: ${JSON.stringify(move)}. Доступные кубики: [${remainingDice.join(', ')}]`);
        }
      }
      // Обновляем кубики в состоянии после применения всех ходов
      state.dice = remainingDice;
    }

    // Используем оставшиеся кубики для расчета возможных ходов
    // Для дублей без pendingMoves ограничиваем до 2 кубиков (UI решение для удобства)
    let diceForMoves = remainingDice;
    if (isDoubles && !hasPendingMoves && diceForMoves.length === 4) {
      // Ограничиваем до первых 2 кубиков (UI решение)
      diceForMoves = diceForMoves.slice(0, 2);
      this.logger.log(`🔒 Doubles detected (UI limitation), limiting possible moves to first 2 dice: [${diceForMoves.join(', ')}]`);
    }

    if (!diceForMoves || diceForMoves.length === 0) {
      return { allMoves: [] };
    }

    // Получаем все возможные комбинации ходов ТОЛЬКО с оставшимися кубиками
    let allMoves: Array<Array<{ from: number; to: number; die: number }>> = [];
    if ('getAllValidMoves' in engine && typeof engine.getAllValidMoves === 'function') {
      // Важно: для дублей передаем только первые 2 кубика (если нет pendingMoves)
      allMoves = engine.getAllValidMoves(state, diceForMoves);
    }
    
    // Преобразуем последовательности в плоский список доступных ходов,
    // включая комбинированные ходы (сумма нескольких кубиков) для одной шашки
    const flatMoves: Array<{ from: number; to: number; die: number; steps?: any[] }> = [];
    const seen = new Set<string>();
    
    // Получаем список доступных кубиков для фильтрации (используем ограниченные кубики для дублей)
    const availableDice = diceForMoves;
    const diceCounts = new Map<number, number>();
    availableDice.forEach(d => diceCounts.set(d, (diceCounts.get(d) || 0) + 1));

    for (const seq of allMoves) {
      if (seq.length === 0) continue;

      // 1. Добавляем все одиночные ходы из последовательностей
      // Но только те, которые используют доступные кубики
      for (const move of seq) {
        // Проверяем, что кубик доступен
        const availableCount = diceCounts.get(move.die) || 0;
        if (availableCount === 0) {
          // Этот кубик уже использован - пропускаем
          continue;
        }
        
        const key = `${move.from}-${move.to}-${move.die}`;
        if (!seen.has(key)) {
          flatMoves.push(move);
          seen.add(key);
        }
      }

      // 2. Добавляем комбинированные ходы (одна шашка идет по цепочке)
      // Мы берем цепочки шагов одной и той же шашки
      // Это позволяет использовать все кубики из дубля одной шашкой (например, 3/3 = 4 кубика по 3, можно походить на 12)
      let currentFrom = seq[0].from;
      let totalDie = seq[0].die;
      let steps = [seq[0]];
      
      // Проверяем доступность всех кубиков в цепочке
      let tempDiceCounts = new Map(diceCounts);
      let allDiceAvailable = true;
      
      // Проверяем первый кубик
      const firstDieCount = tempDiceCounts.get(seq[0].die) || 0;
      if (firstDieCount === 0) {
        continue; // Первый кубик недоступен
      }
      tempDiceCounts.set(seq[0].die, firstDieCount - 1);

      for (let i = 1; i < seq.length; i++) {
        const next = seq[i];
        // Если следующая точка начала совпадает с предыдущей точкой конца - это та же шашка
        if (next.from === seq[i-1].to) {
          // Проверяем доступность кубика для этого шага
          const nextDieCount = tempDiceCounts.get(next.die) || 0;
          if (nextDieCount === 0) {
            allDiceAvailable = false;
            break; // Кубик недоступен
          }
          tempDiceCounts.set(next.die, nextDieCount - 1);
          
          totalDie += next.die;
          steps.push(next);
          const key = `${currentFrom}-${next.to}-${totalDie}`;
          if (!seen.has(key) && allDiceAvailable) {
            flatMoves.push({
              from: currentFrom,
              to: next.to,
              die: totalDie,
              steps: [...steps]
            });
            seen.add(key);
          }
        } else {
          // Цепочка прервалась (другая шашка начала ходить)
          // Сохраняем текущую цепочку, если она содержит более одного шага
          if (steps.length > 1 && allDiceAvailable) {
            const lastStep = steps[steps.length - 1];
            const key = `${currentFrom}-${lastStep.to}-${totalDie}`;
            if (!seen.has(key)) {
              flatMoves.push({
                from: currentFrom,
                to: lastStep.to,
                die: totalDie,
                steps: [...steps]
              });
              seen.add(key);
            }
          }
          // Начинаем новую цепочку
          currentFrom = next.from;
          totalDie = next.die;
          steps = [next];
          // Сбрасываем проверку доступности для новой цепочки
          allDiceAvailable = true;
          tempDiceCounts = new Map(diceCounts);
          // Проверяем доступность первого кубика новой цепочки
          const newFirstDieCount = tempDiceCounts.get(next.die) || 0;
          if (newFirstDieCount === 0) {
            allDiceAvailable = false;
          } else {
            tempDiceCounts.set(next.die, newFirstDieCount - 1);
          }
        }
      }
      
      // Сохраняем последнюю цепочку, если она содержит более одного шага и все кубики доступны
      if (steps.length > 1 && allDiceAvailable) {
        const lastStep = steps[steps.length - 1];
        const key = `${currentFrom}-${lastStep.to}-${totalDie}`;
        if (!seen.has(key)) {
          flatMoves.push({
            from: currentFrom,
            to: lastStep.to,
            die: totalDie,
            steps: [...steps]
          });
          seen.add(key);
        }
      }
    }

    return {
      allMoves,
      movesFromPoint: flatMoves,
    };
  }

  /**
   * Проверяет, является ли победа "Марсом" (разгромной)
   * Марс = противник не вывел ни одной шашки (borneOff = 0)
   */
  private isMarsWin(game: Game): boolean {
    if (!game.gameState || !game.winnerId) return false;
    
    const state = game.gameState;
    const winnerIsPlayer1 = game.winnerId === game.player1Id;
    
    // Проверяем, вывел ли проигравший хотя бы одну шашку
    if (winnerIsPlayer1) {
      // Победил player1, проверяем player2
      return (state.borneOff?.[1] || 0) === 0;
    } else {
      // Победил player2, проверяем player1
      return (state.borneOff?.[0] || 0) === 0;
    }
  }

  /**
   * Получить количество повторных матчей между игроками за последние 24 часа
   */
  private async getRepeatMatchesCount(player1Id: string, player2Id: string): Promise<number> {
    // Нормализуем пару (меньший ID всегда первый)
    const [p1, p2] = player1Id < player2Id ? [player1Id, player2Id] : [player2Id, player1Id];
    
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Ищем историю матчей
    let history = await this.matchHistoryRepository.findOne({
      where: { player1Id: p1, player2Id: p2 },
    });
    
    // Если истории нет или первый матч был больше 24 часов назад, возвращаем 1 (текущий матч)
    if (!history || history.firstMatchAt < dayAgo) {
      return 1;
    }
    
    // Возвращаем количество матчей + текущий
    return history.matchCount + 1;
  }

  /**
   * Обновить историю матчей между игроками
   */
  private async updateMatchHistory(player1Id: string, player2Id: string): Promise<void> {
    // Нормализуем пару
    const [p1, p2] = player1Id < player2Id ? [player1Id, player2Id] : [player2Id, player1Id];
    
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    let history = await this.matchHistoryRepository.findOne({
      where: { player1Id: p1, player2Id: p2 },
    });
    
    if (!history) {
      // Создаем новую запись
      history = this.matchHistoryRepository.create({
        player1Id: p1,
        player2Id: p2,
        matchCount: 1,
        firstMatchAt: now,
        lastMatchAt: now,
      });
    } else if (history.firstMatchAt < dayAgo) {
      // Окно 24 часа истекло, сбрасываем счетчик
      history.matchCount = 1;
      history.firstMatchAt = now;
      history.lastMatchAt = now;
    } else {
      // Увеличиваем счетчик
      history.matchCount += 1;
      history.lastMatchAt = now;
    }
    
    await this.matchHistoryRepository.save(history);
    
    // Очищаем старые записи (старше 24 часов)
    await this.matchHistoryRepository.delete({
      firstMatchAt: LessThan(dayAgo),
    });
  }

  /**
   * Обработка завершения игры: жизни, рейтинги, награды (ставки, опыт)
   */
  private async onGameFinished(game: Game): Promise<void> {
    this.logger.log(`🎁 onGameFinished вызван для игры ${game.id}, тип: ${game.type}, статус: ${game.status}, winnerId: ${game.winnerId}`);
    
    // Проверяем, что игра действительно завершена
    if (game.status !== GameStatus.FINISHED) {
      this.logger.warn(`⚠️ Игра ${game.id} не в статусе FINISHED, статус: ${game.status}`);
      return;
    }

    // Проверяем, что есть победитель
    if (!game.winnerId) {
      this.logger.warn(`⚠️ Игра ${game.id} завершена, но нет winnerId`);
      return;
    }

    const loserId = game.winnerId === game.player1Id ? game.player2Id : game.player1Id;
    const gameType: GameType = game.type;
    
    // Проверяем, что есть проигравший (для игр с игроками)
    if (gameType === GameType.VS_PLAYER && !loserId) {
      this.logger.warn(`⚠️ Игра ${game.id} типа VS_PLAYER, но нет loserId`);
      return;
    }
    
    this.logger.log(`🎮 Обработка наград: winnerId=${game.winnerId}, loserId=${loserId}, stake=${game.stake}`);

    // Обработка ставок - победитель получает обе ставки (с учетом комиссии)
    if (game.stake > 0 && game.type === GameType.VS_PLAYER && game.winnerId && loserId) {
      try {
        const stake = Number(game.stake);
        const totalPot = stake * 2;
        const baseCommission = Math.floor(totalPot * 0.15); // Базовая комиссия 15%
        
        // Применяем снижение комиссии через ветку Экономика и экипировку
        const winnerUser = await this.usersService.findOne(game.winnerId);
        const econSp = winnerUser.economySp || 0;
        
        // Получаем бонус комиссии от экипировки (TODO: реализовать получение из скинов)
        const gearCommissionBonus = 0; // Пока нет реализации бонусов от экипировки
        
        const finalCommission = this.progressService.calculateFeeWithEconomy(
          baseCommission,
          econSp,
          gearCommissionBonus,
        );
        const winnerReward = totalPot - finalCommission;

        // Получаем бонусы от скинов для денег
        const winnerBonuses = await this.skinsService.getSkinBonuses(game.winnerId);
        const moneyBonus = Math.floor(winnerReward * (winnerBonuses.moneyBonusPercent / 100));
        const finalWinnerReward = winnerReward + moneyBonus;
        
        const winnerBalance = Number(winnerUser.narCoin);
        const newWinnerBalance = winnerBalance + finalWinnerReward;
        await this.usersService.update(game.winnerId, { narCoin: newWinnerBalance });
        
        // Пополняем казну города комиссией
        await this.progressService.addToCityTreasury(finalCommission);
        
        this.logger.log(`💰 Награда начислена победителю ${game.winnerId}: +${finalWinnerReward} NAR (базовая: ${winnerReward}, бонус: ${moneyBonus} (${winnerBonuses.moneyBonusPercent}%)), было ${winnerBalance}, стало ${newWinnerBalance}, комиссия: ${finalCommission} NAR (в казну)`);
      } catch (error) {
        this.logger.error(`❌ Ошибка при начислении ставки: ${error.message}`, error.stack);
      }
    }

    // Начисление опыта по новой системе с множителями
    if (game.type === GameType.VS_PLAYER && game.winnerId && loserId) {
      try {
        // Получаем рейтинги игроков (нужен mode для получения рейтинга)
        const winnerRating = await this.ratingsService.getRating(game.winnerId, game.mode) || 1000;
        const loserRating = await this.ratingsService.getRating(loserId, game.mode) || 1000;
        
        // Получаем количество повторных матчей за 24 часа
        const repeatMatchesCount = await this.getRepeatMatchesCount(game.winnerId, loserId);
        
        // Получаем бонусы от скинов
        const winnerBonuses = await this.skinsService.getSkinBonuses(game.winnerId);
        const loserBonuses = await this.skinsService.getSkinBonuses(loserId);
        
        // Извлекаем бонусы XP из скинов (преобразуем проценты в десятичные)
        const winnerItemsXPBonus = [winnerBonuses.xpBonusPercent / 100];
        const loserItemsXPBonus = [loserBonuses.xpBonusPercent / 100];
        
        // Проверяем "Марс" (разгромная победа - противник не вывел ни одной шашки)
        const isMarsWin = this.isMarsWin(game);
        
        // Определяем тип игры для расчета XP (игры на NAR-coin имеют другой базовый XP)
        const xpGameType = game.stake && game.stake > 0 ? GameType.VS_PLAYER : game.type;
        
        // Рассчитываем XP для победителя
        const winnerXP = this.xpCalculator.calculateXP({
          mode: game.mode,
          gameType: game.type,
          playerWon: true,
          playerRating: winnerRating,
          opponentRating: loserRating,
          repeatMatchesCount: repeatMatchesCount,
          itemsXPBonus: winnerItemsXPBonus,
          isMarsWin: isMarsWin,
          trustLevel: 'high', // TODO: Реализовать систему доверия
          stake: Number(game.stake || 0),
        });
        
        // Рассчитываем XP для проигравшего
        const loserXP = this.xpCalculator.calculateXP({
          mode: game.mode,
          gameType: game.type,
          playerWon: false,
          playerRating: loserRating,
          opponentRating: winnerRating,
          repeatMatchesCount: repeatMatchesCount,
          itemsXPBonus: loserItemsXPBonus,
          isMarsWin: false,
          trustLevel: 'high',
          stake: Number(game.stake || 0),
        });
        
        // Начисляем XP
        const winnerResult = await this.progressService.addXP(game.winnerId, winnerXP);
        const loserResult = await this.progressService.addXP(loserId, loserXP);
        
        // Тратим энергию при завершении матча согласно таблице 9 спецификации
        const isTournament = gameType === GameType.TOURNAMENT;
        try {
          await this.progressService.consumeEnergyForFinishedGame(game.winnerId, gameType, true, isTournament);
          await this.progressService.consumeEnergyForFinishedGame(loserId, gameType, false, isTournament);
        } catch (error) {
          this.logger.error(`❌ Ошибка при трате энергии после завершения игры: ${error.message}`);
        }
        
        // Тратим жизнь при поражении (только для боевых матчей)
        if (gameType === GameType.VS_PLAYER || gameType === GameType.TOURNAMENT) {
          try {
            await this.progressService.loseLifeOnDefeat(loserId);
          } catch (error) {
            this.logger.error(`❌ Ошибка при трате жизни после поражения: ${error.message}`);
          }
        }
        
        // Обновляем историю матчей для анти-фарма
        await this.updateMatchHistory(game.winnerId, loserId);
        
        this.logger.log(`⭐ XP начислен: победитель ${game.winnerId} +${winnerXP} XP (Марс: ${isMarsWin}, повторы: ${repeatMatchesCount}), проигравший ${loserId} +${loserXP} XP`);
        
        // Если уровень повысился, логируем
        if (winnerResult.levelUp) {
          this.logger.log(`🎉 Победитель ${game.winnerId} повысил уровень до ${winnerResult.newLevel}!`);
        }
        if (loserResult.levelUp) {
          this.logger.log(`🎉 Проигравший ${loserId} повысил уровень до ${loserResult.newLevel}!`);
        }
        
        // Обновляем прогресс заданий обучения
        try {
          await this.trainingService.updateTaskProgress(game.winnerId, TaskType.PLAY_GAME, 1);
          await this.trainingService.updateTaskProgress(game.winnerId, TaskType.WIN_GAME, 1);
          if (loserId) {
            await this.trainingService.updateTaskProgress(loserId, TaskType.PLAY_GAME, 1);
          }
        } catch (error) {
          this.logger.error(`❌ Ошибка при обновлении заданий обучения: ${error.message}`);
        }
      } catch (error) {
        this.logger.error(`❌ Ошибка при начислении XP: ${error.message}`, error.stack);
      }
    }
    
    // Обновление квестов при завершении игры - ВСЕГДА вызывается при завершении
    try {
      if (game.winnerId) {
        // Для игр с игроками обновляем квесты для обоих
        if (game.type === GameType.VS_PLAYER && loserId) {
          this.logger.log(`📋 Обновление квестов для VS_PLAYER игры: winner=${game.winnerId}, loser=${loserId}`);
          await this.questsService.updateProgress(game.winnerId, QuestTarget.PLAY_MATCHES, 1);
          await this.questsService.updateProgress(loserId, QuestTarget.PLAY_MATCHES, 1);
          // Обновляем квесты на серию побед для победителя
          await this.questsService.updateProgress(game.winnerId, QuestTarget.WIN_STREAK, 1);
          this.logger.log(`✅ Квесты обновлены для игроков ${game.winnerId} и ${loserId}`);
        }
        // Для игр с ботом обновляем квесты только для игрока
        else if (game.type === GameType.VS_BOT) {
          this.logger.log(`📋 Обновление квестов для VS_BOT игры: player=${game.winnerId}`);
          // Всегда обновляем play_matches для игрока (независимо от результата)
          await this.questsService.updateProgress(game.player1Id, QuestTarget.PLAY_MATCHES, 1);
          // Если игрок победил бота, засчитываем серию побед
          if (game.winnerId === game.player1Id) {
            await this.questsService.updateProgress(game.winnerId, QuestTarget.WIN_STREAK, 1);
            this.logger.log(`✅ Квесты обновлены для игрока ${game.winnerId} (победа над ботом)`);
          } else {
            this.logger.log(`✅ Квесты обновлены для игрока ${game.player1Id} (поражение от бота, win_streak не обновлен)`);
          }
        }
        // Для турнирных игр тоже обновляем квесты
        else if (game.type === GameType.TOURNAMENT && loserId) {
          this.logger.log(`📋 Обновление квестов для TOURNAMENT игры: winner=${game.winnerId}, loser=${loserId}`);
          await this.questsService.updateProgress(game.winnerId, QuestTarget.PLAY_MATCHES, 1);
          await this.questsService.updateProgress(loserId, QuestTarget.PLAY_MATCHES, 1);
          await this.questsService.updateProgress(game.winnerId, QuestTarget.WIN_STREAK, 1);
          this.logger.log(`✅ Квесты обновлены для турнирной игры`);
        }
      } else {
        this.logger.warn(`⚠️ Игра ${game.id} завершена, но нет winnerId - квесты не обновлены`);
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка при обновлении квестов: ${error.message}`, error.stack);
      // Не прерываем выполнение, просто логируем ошибку
    }

    // Обновление рейтингов (для VS_PLAYER и TOURNAMENT игр)
    if ((game.type === GameType.VS_PLAYER || game.type === GameType.TOURNAMENT) && game.mode && game.winnerId && loserId) {
      try {
        await this.ratingsService.updateRatings(
          game.winnerId,
          loserId,
          game.mode,
          false,
        );
        this.logger.log(`📊 Рейтинги обновлены для игры ${game.id} (тип: ${game.type})`);
      } catch (error) {
        // Игнорируем ошибки рейтинга, чтобы не сломать завершение игры
        this.logger.error(`❌ Ошибка при обновлении рейтингов: ${error.message}`);
      }
    }

    // Завершение турнирного матча (если это турнирная игра)
    if (game.type === GameType.TOURNAMENT && game.winnerId) {
      try {
        // Находим турнирный матч по gameId
        const tournamentMatch = await this.tournamentsService.findMatchByGameId(game.id);
        if (tournamentMatch) {
          await this.tournamentsService.finishMatch(tournamentMatch.id, game.winnerId);
          this.logger.log(`🏆 Турнирный матч ${tournamentMatch.id} завершен, победитель: ${game.winnerId}`);
        }
      } catch (error) {
        this.logger.error(`❌ Ошибка при завершении турнирного матча: ${error.message}`);
      }
    }
    
    this.logger.log(`✅ onGameFinished завершен для игры ${game.id}`);
  }

  /**
   * Сдача игры игроком
   */
  async resignGame(gameId: string, playerId: string): Promise<Game> {
    const game = await this.findOne(gameId);

    if (game.player1Id !== playerId && game.player2Id !== playerId) {
      throw new BadRequestException('Вы не участник этой игры');
    }

    // Если игра уже завершена - награды уже начислены, просто возвращаем игру
    if (game.status === GameStatus.FINISHED) {
      // Награды уже должны быть начислены при первом завершении игры
      // Повторное начисление не требуется
      return game;
    }

    // Если игра в статусе WAITING (ожидание) - отменяем игру, возвращаем ставки
    if (game.status === GameStatus.WAITING) {
      // Возвращаем ставки обоим игрокам (если были ставки)
      if (game.stake > 0 && game.type === GameType.VS_PLAYER) {
        const stake = Number(game.stake);
        
        // Возвращаем ставку player1
        const player1 = await this.usersService.findOne(game.player1Id);
        const player1Balance = Number(player1.narCoin);
        await this.usersService.update(game.player1Id, { narCoin: player1Balance + stake });
        
        // Возвращаем ставку player2 (если был)
        if (game.player2Id) {
          const player2 = await this.usersService.findOne(game.player2Id);
          const player2Balance = Number(player2.narCoin);
          await this.usersService.update(game.player2Id, { narCoin: player2Balance + stake });
        }
      }

      // Помечаем игру как ABANDONED (не состоялась)
      game.status = GameStatus.ABANDONED;
      const savedGame = await this.gamesRepository.save(game);
      
      // Удаляем стол из Redis через MatchmakingService (если есть)
      // Note: Это требует инжекции MatchmakingService, но для избежания циклической зависимости
      // можно использовать прямое удаление через Redis или событие
      
      return savedGame;
    }

    // Если игра в статусе IN_PROGRESS - засчитываем поражение выходящему игроку
    if (game.status === GameStatus.IN_PROGRESS) {
      // Определяем победителя (противник сдавшегося игрока)
      const winnerId = game.player1Id === playerId ? game.player2Id : game.player1Id;
      
      if (!winnerId) {
        throw new BadRequestException('Невозможно сдать игру без противника');
      }

      // Завершаем игру с поражением вышедшего
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

      // Применяем логику после завершения игры (награды, рейтинги)
      await this.onGameFinished(savedGame);

      return savedGame;
    }

    // Если статус неожиданный, просто возвращаем игру
    return game;
  }

  async createBotGame(playerId: string, mode?: GameMode): Promise<Game> {
    try {
      // Для игр с ИИ игра начинается сразу, без этапа ожидания
      const gameMode = mode || GameMode.LONG;
      
      // Проверяем, что пользователь существует (для гостей это важно)
      let user;
      try {
        user = await this.usersService.findOne(playerId);
        this.logger.log(`✅ Пользователь найден: playerId=${playerId}, username=${user.username}, isGuest=${user.isGuest}`);
      } catch (error: any) {
        this.logger.error(`❌ Пользователь не найден при создании игры с ботом: playerId=${playerId}`, error);
        this.logger.error(`❌ Ошибка детали:`, { 
          message: error.message, 
          code: error.code, 
          statusCode: error.statusCode,
          stack: error.stack 
        });
        
        // Если это NotFoundException, пробуем найти пользователя другим способом
        if (error.statusCode === 404 || error.message?.includes('не найден')) {
          // Попробуем найти пользователя по telegramId, если playerId не найден
          try {
            // Для гостей telegramId может быть в формате guest_...
            const possibleTelegramIds = [
              `guest_${playerId}`,
              playerId.replace(/^guest_/, ''),
            ];
            
            for (const telegramId of possibleTelegramIds) {
              const userByTelegramId = await this.usersService.findByTelegramId(telegramId);
              if (userByTelegramId) {
                this.logger.log(`✅ Пользователь найден по telegramId: ${telegramId} -> ${userByTelegramId.id}`);
                playerId = userByTelegramId.id;
                user = userByTelegramId;
                break;
              }
            }
            
            if (!user) {
              throw new BadRequestException(`Пользователь не найден в базе данных. PlayerId: ${playerId}`);
            }
          } catch (findError: any) {
            this.logger.error(`❌ Ошибка при поиске пользователя по telegramId:`, findError);
            throw new BadRequestException(`Пользователь не найден: ${error.message || findError.message || 'Неизвестная ошибка'}`);
          }
        } else {
          throw new BadRequestException(`Ошибка при поиске пользователя: ${error.message || 'Неизвестная ошибка'}`);
        }
      }
      
      if (!user) {
        throw new BadRequestException('Пользователь не найден после всех проверок');
      }
      
      // Проверяем, не находится ли игрок уже в активной игре
      const player1ActiveGames = await this.gamesRepository.find({
        where: [
          { player1Id: playerId, status: GameStatus.WAITING },
          { player1Id: playerId, status: GameStatus.IN_PROGRESS },
          { player2Id: playerId, status: GameStatus.WAITING },
          { player2Id: playerId, status: GameStatus.IN_PROGRESS },
        ],
      });
      // Фильтруем только действительно активные игры (исключаем игры с ботом)
      const trulyActivePlayer1Games = player1ActiveGames.filter(game => 
        (game.status === GameStatus.WAITING || game.status === GameStatus.IN_PROGRESS) &&
        game.type !== GameType.VS_BOT
      );
      if (trulyActivePlayer1Games.length > 0) {
        throw new BadRequestException('Вы уже находитесь в активной игре. Завершите текущую игру перед созданием новой.');
      }

      // Проверка энергии для игр с ботом не требуется (бот-игры не тратят энергию)
      // Проверка жизней для игр с ботом не требуется

      const rngSeed = crypto.randomBytes(32).toString('hex');
      const rngHash = crypto.createHash('sha256').update(rngSeed).digest('hex');

      const engine = gameMode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
      const initialState = engine.createInitialState();

      // Игра с ИИ сразу начинается (IN_PROGRESS)
      const game = this.gamesRepository.create({
        player1Id: playerId,
        player2Id: null, // Бот не имеет player2Id
        mode: gameMode,
        type: GameType.VS_BOT,
        stake: 0, // Игры с ботом без ставок
        status: GameStatus.IN_PROGRESS, // Сразу начинаем игру
        gameState: initialState,
        rngSeed,
        rngHash,
        currentPlayer: 0, // Игрок начинает первым
        moveTimeLimit: 60000,
        lastMoveAt: new Date(),
      });

      const savedGame = await this.gamesRepository.save(game);

      // Сразу бросаем кубики для игрока
      const dice = await this.rollDice(savedGame.id, playerId);
      
      this.logger.log(`🤖 Создана игра с ИИ: gameId=${savedGame.id}, playerId=${playerId}, mode=${gameMode}, dice=[${dice.join(', ')}]`);

      return savedGame;
    } catch (error) {
      this.logger.error(`❌ Ошибка при создании игры с ботом для playerId=${playerId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при создании игры: ${error.message || 'Неизвестная ошибка'}`);
    }
  }

  async getGameRewards(gameId: string, userId: string): Promise<{ xp: number; narCoin?: number }> {
    const game = await this.findOne(gameId);
    
    if (game.status !== GameStatus.FINISHED) {
      return { xp: 0 };
    }

    const isPlayer1 = game.player1Id === userId;
    const isWinner = game.winnerId === userId;
    const isDraw = !game.winnerId;
    const opponentId = isPlayer1 ? game.player2Id : game.player1Id;

    // Если игра с ботом или нет соперника
    if (!opponentId || game.type === GameType.VS_BOT) {
      // Для игр с ботом используем упрощенный расчет
      const baseXP = game.mode === GameMode.SHORT ? 50 : 75;
      const xp = isWinner ? baseXP : Math.floor(baseXP * 0.5);
      return { xp };
    }

    // Для игр с игроком пересчитываем XP используя те же параметры, что и при завершении
    try {
      const winnerRating = await this.ratingsService.getRating(game.winnerId || '', game.mode) || 1000;
      const loserRating = opponentId ? (await this.ratingsService.getRating(opponentId, game.mode) || 1000) : 1000;
      
      const repeatMatchesCount = await this.getRepeatMatchesCount(game.winnerId || '', opponentId);
      
      const playerBonuses = await this.skinsService.getSkinBonuses(userId);
      const playerItemsXPBonus = [playerBonuses.xpBonusPercent / 100];
      
      const isMarsWin = this.isMarsWin(game);
      
      const xpGameType = game.stake && game.stake > 0 ? GameType.VS_PLAYER : game.type;
      
      const playerRating = isWinner ? winnerRating : loserRating;
      const opponentRating = isWinner ? loserRating : winnerRating;
      
      const xp = this.xpCalculator.calculateXP({
        mode: game.mode,
        gameType: xpGameType,
        playerWon: isWinner,
        playerRating,
        opponentRating,
        repeatMatchesCount,
        itemsXPBonus: playerItemsXPBonus,
        isMarsWin: isWinner && isMarsWin,
        trustLevel: 'high',
        stake: Number(game.stake || 0),
      });

      // Вычисляем NAR-coin награду, если была ставка
      let narCoinReward: number | undefined = undefined;
      if (game.stake && game.stake > 0 && isWinner) {
        const stakeValue = Number(game.stake);
        const totalPot = stakeValue * 2;
        const baseCommission = Math.floor(totalPot * 0.15);
        
        const winnerUser = await this.usersService.findOne(game.winnerId || '');
        const econSp = winnerUser?.economySp || 0;
        const gearCommissionBonus = 0; // TODO: получить из скинов
        
        const finalCommission = this.progressService.calculateFeeWithEconomy(
          baseCommission,
          econSp,
          gearCommissionBonus,
        );
        
        const winnerReward = totalPot - finalCommission;
        const winnerBonuses = await this.skinsService.getSkinBonuses(game.winnerId || '');
        const moneyBonus = Math.floor(winnerReward * (winnerBonuses.moneyBonusPercent / 100));
        narCoinReward = winnerReward + moneyBonus;
      }

      this.logger.log(`✅ Рассчитаны награды для игры ${gameId}, userId=${userId}: XP=${xp}, NAR=${narCoinReward || 0}`);
      return { xp, narCoin: narCoinReward };
    } catch (error) {
      this.logger.error(`Ошибка при расчете наград для игры ${gameId}, userId=${userId}:`, error);
      // Fallback на базовые значения
      const baseXP = game.mode === GameMode.SHORT ? 50 : 75;
      const xp = isWinner ? baseXP : Math.floor(baseXP * 0.5);
      this.logger.log(`⚠️ Используется fallback XP для игры ${gameId}: ${xp}`);
      return { xp };
    }
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
      rngHash: game.rngHash,
      p1Offset: game.p1Offset,
      p2Offset: game.p2Offset,
      createdAt: game.createdAt ? game.createdAt.toISOString() : null,
      updatedAt: game.updatedAt ? game.updatedAt.toISOString() : null,
      verificationSalt: game.status === GameStatus.FINISHED ? game.verificationSalt : undefined,
      p1Rolls: game.status === GameStatus.FINISHED ? game.p1Rolls : undefined,
      p2Rolls: game.status === GameStatus.FINISHED ? game.p2Rolls : undefined,
    };
  }

  async setOffset(gameId: string, playerId: string, offset: number): Promise<Game> {
    const game = await this.findOne(gameId);
    if (game.status !== GameStatus.WAITING && game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Нельзя изменить смещение после начала игры');
    }
    
    // В длинных нардах и на сайте nardgammon смещение можно менять за несколько секунд до старта.
    // Для простоты разрешим менять пока статус WAITING или IN_PROGRESS, но если ходов еще не было.
    if ((game.moves || []).length > 0) {
      throw new BadRequestException('Нельзя изменить смещение после начала совершения ходов');
    }

    if (offset < 1 || offset > 100) {
      throw new BadRequestException('Смещение должно быть от 1 до 100');
    }

    if (game.player1Id === playerId) {
      game.p1Offset = offset;
    } else if (game.player2Id === playerId) {
      game.p2Offset = offset;
    } else {
      throw new BadRequestException('Вы не участник этой игры');
    }

    return this.gamesRepository.save(game);
  }
}
