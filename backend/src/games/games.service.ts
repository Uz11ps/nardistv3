import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Game, GameMode, GameStatus, GameType } from './game.entity';
import { GameMove } from './game-move.entity';
import { SandboxChapter } from './sandbox-chapter.entity';
import { PlayerMatchHistory } from './player-match-history.entity';
import { BackgammonEngine } from './game-engine/backgammon-engine';
import { LongBackgammonEngine } from './game-engine/long-backgammon-engine';
import { ProgressService } from '../progress/progress.service';
import { XpCalculatorService } from '../progress/xp-calculator.service';
import { ProgressionBranchesService } from '../progress/progression-branches.service';
import { RatingsService } from '../ratings/ratings.service';
import { UsersService } from '../users/users.service';
import { BotService } from '../bot/bot.service';
import { SkinsService } from '../skins/skins.service';
import { QuestsService } from '../quests/quests.service';
import { QuestTarget } from '../quests/quest.entity';
import { TrainingService } from '../training/training.service';
import { TaskType } from '../training/training-task.entity';
import { TournamentsService } from '../tournaments/tournaments.service';
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
    @InjectRepository(PlayerMatchHistory)
    private matchHistoryRepository: Repository<PlayerMatchHistory>,
    @InjectRepository(SandboxChapter)
    private sandboxChapterRepository: Repository<SandboxChapter>,
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
    private branchesService: ProgressionBranchesService,
    @Inject(forwardRef(() => TournamentsService))
    private tournamentsService: TournamentsService,
    @Inject(forwardRef(() => GamesGateway))
    private gamesGateway: GamesGateway,
  ) {}

  async create(
    player1Id: string,
    player2Id: string | null,
    mode: GameMode,
    type: GameType,
    stake: number = 0,
    moveTimeLimit: number = 60000,
    matchesToWin: number = 1,
    matchSeriesId: string | null = null,
    player1Wins: number = 0,
    player2Wins: number = 0,
  ): Promise<Game> {
    // Нормализуем stake (защита от NaN, null, undefined, bigint)
    const normalizedStake = (stake !== null && stake !== undefined && !isNaN(stake) && isFinite(stake)) 
      ? Math.max(0, Number(stake)) 
      : 0;
    
    // Нормализуем moveTimeLimit (защита от NaN, null, undefined)
    const normalizedMoveTimeLimit = (moveTimeLimit !== null && moveTimeLimit !== undefined && !isNaN(moveTimeLimit) && isFinite(moveTimeLimit))
      ? Math.max(0, Number(moveTimeLimit))
      : 60000;
    // Проверяем, не находится ли player1 уже в активной игре (исключаем finished, abandoned и игры с ботом)
    const player1ActiveGames = await this.gamesRepository.find({
      where: [
        { player1Id, status: GameStatus.WAITING },
        { player1Id, status: GameStatus.IN_PROGRESS },
        { player2Id: player1Id, status: GameStatus.WAITING },
        { player2Id: player1Id, status: GameStatus.IN_PROGRESS },
      ],
    });
    // Фильтруем только действительно активные игры (исключаем игры с ботом и sandbox)
    const trulyActivePlayer1Games = player1ActiveGames.filter(game => 
      (game.status === GameStatus.WAITING || game.status === GameStatus.IN_PROGRESS) &&
      game.type !== GameType.VS_BOT &&
      game.type !== GameType.SANDBOX
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
      // Фильтруем только действительно активные игры (исключаем игры с ботом и sandbox)
      const trulyActivePlayer2Games = player2ActiveGames.filter(game => 
        (game.status === GameStatus.WAITING || game.status === GameStatus.IN_PROGRESS) &&
        game.type !== GameType.VS_BOT &&
        game.type !== GameType.SANDBOX
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
    if (normalizedStake > 0 && type === GameType.VS_PLAYER) {
      const player1 = await this.usersService.findOne(player1Id);
      const player1Balance = Number(player1.narCoin);
      if (player1Balance < normalizedStake) {
        throw new BadRequestException('Недостаточно NAR-coin для ставки');
      }
      // Блокируем ставку (вычитаем сразу, вернем проигравшему позже при завершении)
      const newPlayer1Balance = player1Balance - normalizedStake;
      await this.usersService.update(player1Id, { narCoin: newPlayer1Balance });
      this.logger.log(`💰 Ставка списана у игрока ${player1Id}: -${normalizedStake} NAR (было ${player1Balance}, стало ${newPlayer1Balance})`);

      if (player2Id) {
        const player2 = await this.usersService.findOne(player2Id);
        const player2Balance = Number(player2.narCoin);
        if (player2Balance < normalizedStake) {
          // Возвращаем деньги player1
          await this.usersService.update(player1Id, { narCoin: player1Balance });
          throw new BadRequestException('У противника недостаточно NAR-coin для ставки');
        }
        const newPlayer2Balance = player2Balance - normalizedStake;
        await this.usersService.update(player2Id, { narCoin: newPlayer2Balance });
        this.logger.log(`💰 Ставка списана у игрока ${player2Id}: -${normalizedStake} NAR (было ${player2Balance}, стало ${newPlayer2Balance})`);
      }
    }

    const rngSeed = crypto.randomBytes(32).toString('hex');
    const verificationSalt = crypto.randomBytes(16).toString('hex');
    
    // НЕ генерируем броски здесь - они будут сгенерированы ПОСЛЕ выбора смещения обоими игроками
    // Это гарантирует, что броски зависят от выбранных смещений
    const p1Rolls = null;
    const p2Rolls = null;
    const rngHash = null; // Будет установлен после генерации бросков

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

    // Если это первая игра в серии, создаем новый matchSeriesId
    const finalMatchSeriesId = matchSeriesId || (matchesToWin > 1 ? crypto.randomBytes(16).toString('hex') : null);

    const game = this.gamesRepository.create({
      player1Id,
      player2Id,
      mode,
      type,
      stake: normalizedStake,
      status: GameStatus.WAITING, // Игра всегда создается в WAITING, переходит в IN_PROGRESS когда оба игрока выберут смещение
      gameState: initialState,
      rngSeed,
      rngHash,
      p1Rolls,
      p2Rolls,
      verificationSalt,
      p1Offset: 1,
      p2Offset: 1,
      p1OffsetChosenAt: null,
      p2OffsetChosenAt: null,
      currentPlayer: 0,
      moveTimeLimit: normalizedMoveTimeLimit,
      player1TimeRemaining: 60000, // 60 секунд общего времени
      player2TimeRemaining: 60000, // 60 секунд общего времени
      lastMoveAt: undefined, // Устанавливается когда игра переходит в IN_PROGRESS
      skinData,
      matchesToWin,
      matchSeriesId: finalMatchSeriesId,
      player1Wins,
      player2Wins,
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
      
      // Включаем все активные игры (VS_PLAYER и VS_BOT) - таймер должен работать для всех
      return await this.gamesRepository.find({
        where: { 
          status: GameStatus.IN_PROGRESS,
        },
        relations: [], // Не загружаем relations для производительности
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      const errorStack = error?.stack || 'No stack trace';
      
      this.logger.error(`Error fetching active in-progress games: ${errorMessage}`);
      this.logger.debug(`Error stack: ${errorStack}`);
      
      return [];
    }
  }

  /**
   * Получает все активные игры конкретного игрока
   */
  async getActiveGamesByPlayer(playerId: string): Promise<Game[]> {
    try {
      if (!this.gamesRepository) {
        this.logger.warn('gamesRepository is not initialized');
        return [];
      }
      
      return await this.gamesRepository.find({
        where: [
          { status: GameStatus.IN_PROGRESS, player1Id: playerId },
          { status: GameStatus.IN_PROGRESS, player2Id: playerId },
        ],
        relations: [],
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      this.logger.error(`Error fetching active games for player ${playerId}: ${errorMessage}`);
      return [];
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

      // Фильтруем только действительно активные игры (исключаем игры с ботом и sandbox)
      const trulyActiveGames = activeGames.filter(game => 
        (game.status === GameStatus.IN_PROGRESS || game.status === GameStatus.WAITING) &&
        game.type !== GameType.VS_BOT &&
        game.type !== GameType.SANDBOX
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

    // Проверяем, что оба игрока выбрали смещение перед броском кубиков
    // Это проверка для ВСЕХ типов игр (обычные, бот, песочница)
    const bothOffsetsChosen = game.p1OffsetChosenAt !== null && game.p2OffsetChosenAt !== null;
    if (!bothOffsetsChosen) {
      throw new BadRequestException('Нельзя бросать кубики до выбора смещения обоими игроками');
    }

    // Пропускаем проверку игрока только при начальном броске (skipPlayerCheck = true)
    if (!skipPlayerCheck) {
      const currentPlayerId = game.currentPlayer === 0 ? game.player1Id : game.player2Id;
      // For bot games, player2Id is null, so we skip the check if it's a bot turn
      const isBotTurn = game.type === GameType.VS_BOT && game.player2Id === null && game.currentPlayer === 1;
      // For sandbox games, player1Id can move for both sides
      const isSandboxTurn = game.type === GameType.SANDBOX && game.player1Id === playerId;
      
      if (!isBotTurn && !isSandboxTurn && currentPlayerId !== playerId) {
        throw new BadRequestException('Не ваш ход');
      }
    }

    const engine = game.mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    
    // Контроль честности: выбираем бросок из последовательности
    // ВАЖНО: Для бота playerId может быть null, определяем игрока по currentPlayer
    let isPlayer1: boolean;
    if (playerId === null) {
      // Это бот - определяем по currentPlayer
      isPlayer1 = game.currentPlayer === 1; // Если currentPlayer === 1, значит это бот (player2)
    } else {
      isPlayer1 = playerId === game.player1Id;
    }
    
    const playerRolls = isPlayer1 ? game.p1Rolls : game.p2Rolls;
    const myOffset = isPlayer1 ? game.p1Offset : game.p2Offset;
    const opponentOffset = isPlayer1 ? game.p2Offset : game.p1Offset;
    
    // Формула смещения: (Смещение игрока - 1) * 2 + Смещение соперника
    // Это определяет начальную позицию в последовательности бросков
    const startIdx = ((myOffset || 1) - 1) * 2 + (opponentOffset || 1);
    
    // ВАЖНО: Считаем количество БРОСКОВ кубиков для этого игрока
    // Бросок происходит каждый раз, когда игрок начинает свой ход (когда dice пустые)
    // 
    // ЛОГИКА:
    // 1. При определении первого игрока используются p1Rolls[startIdx] и p2Rolls[startIdx] для обоих игроков
    // 2. Если player1 был выбран первым, то его первый реальный бросок использует startIdx + 1 (т.к. startIdx уже использован)
    // 3. Если player2 не был выбран первым, то его первый реальный бросок использует startIdx + 0 (т.к. startIdx еще не использован для него)
    // 4. Каждый последующий бросок игрока увеличивает rollCount на 1
    
    const playerNumber = isPlayer1 ? 0 : 1;
    let rollCount = 0;
    
    // Проверяем, был ли этот игрок выбран первым при определении первого игрока
    // Это определяется по тому, был ли startIdx использован для этого игрока при определении первого игрока
    // Если game.currentPlayer === playerNumber и нет ходов, значит этот игрок был выбран первым
    const wasFirstPlayer = game.currentPlayer === playerNumber;
    
    if (game.moves && game.moves.length > 0) {
      // Считаем количество раз, когда этот игрок начинал свой ход (бросал кубики)
      // Каждая смена игрока означает новый бросок для нового игрока
      let previousPlayer: number | null = null;
      let playerRollCount = 0; // Количество раз, когда этот игрок начинал свой ход
      
      for (const move of game.moves) {
        const movePlayerId = move.playerId;
        const moveIsPlayer1 = movePlayerId === game.player1Id;
        const movePlayer = moveIsPlayer1 ? 0 : 1;
        
        // Если сменился игрок - предыдущий игрок завершил ход, новый игрок начинает (бросает кубики)
        if (previousPlayer !== null && previousPlayer !== movePlayer) {
          // Сменился игрок - новый игрок начинает свой ход (бросает кубики)
          if (movePlayer === playerNumber) {
            playerRollCount++;
          }
        } else if (previousPlayer === null) {
          // Первый ход в игре - это первый бросок для первого игрока
          if (movePlayer === playerNumber) {
            playerRollCount++;
          }
        }
        
        previousPlayer = movePlayer;
      }
      
      // ВАЖНО: Если игрок был выбран первым, то startIdx уже был использован для определения первого игрока
      // Поэтому его первый реальный бросок должен использовать startIdx + 1, а не startIdx + 0
      // Если игрок уже делал ходы, то playerRollCount уже учитывает все его броски
      // Но нужно добавить 1, если он был первым игроком (потому что startIdx уже был использован)
      if (wasFirstPlayer) {
        // Этот игрок был выбран первым, значит startIdx уже был использован для определения первого игрока
        // Его первый реальный бросок использовал startIdx + 1, второй - startIdx + 2, и т.д.
        rollCount = playerRollCount + 1; // +1 потому что startIdx уже использован
      } else {
        // Этот игрок не был выбран первым, значит startIdx еще не был использован для него
        // Его первый реальный бросок использует startIdx + 0, второй - startIdx + 1, и т.д.
        rollCount = playerRollCount;
      }
    } else {
      // Нет ходов - это первый бросок в игре (для определения первого игрока)
      // Но если currentPlayer уже установлен, значит первый бросок уже был использован
      if (wasFirstPlayer) {
        // Этот игрок был первым, значит startIdx уже был использован для определения первого игрока
        // Его первый реальный бросок должен использовать startIdx + 1
        rollCount = 1;
      } else {
        // Этот игрок не был первым, значит startIdx еще не был использован для него
        // Его первый реальный бросок должен использовать startIdx + 0
        rollCount = 0;
      }
    }
    
    // Текущий индекс в последовательности бросков
    const currentRollIdx = (startIdx + rollCount) % (playerRolls?.length || 1000);
    
    // ВАЖНО: Проверяем, что playerRolls существует и содержит данные
    if (!playerRolls || !Array.isArray(playerRolls) || playerRolls.length === 0) {
      this.logger.error(`❌ CRITICAL: playerRolls is empty or invalid! player=${isPlayer1 ? 'P1' : 'P2'}, gameId=${gameId}`);
      throw new BadRequestException('Последовательность бросков не была сгенерирована. Пожалуйста, выберите смещение.');
    }
    
    // Проверяем, что индекс в пределах массива
    if (currentRollIdx < 0 || currentRollIdx >= playerRolls.length) {
      this.logger.error(`❌ CRITICAL: currentRollIdx out of bounds! player=${isPlayer1 ? 'P1' : 'P2'}, currentRollIdx=${currentRollIdx}, playerRolls.length=${playerRolls.length}, startIdx=${startIdx}, rollCount=${rollCount}`);
      throw new BadRequestException(`Индекс броска вне допустимых пределов: ${currentRollIdx}`);
    }
    
    const diceRoll = playerRolls[currentRollIdx];
    
    // Логируем детальную информацию для отладки
    this.logger.log(`🎲 Provably Fair Dice: player=${isPlayer1 ? 'P1' : 'P2'}, gameId=${gameId}`);
    this.logger.log(`🎲   myOffset=${myOffset}, opponentOffset=${opponentOffset}`);
    this.logger.log(`🎲   startIdx=${startIdx}, rollCount=${rollCount}, currentRollIdx=${currentRollIdx}`);
    this.logger.log(`🎲   playerRolls.length=${playerRolls.length}`);
    this.logger.log(`🎲   wasFirstPlayer=${wasFirstPlayer}, moves.length=${game.moves?.length || 0}`);
    this.logger.log(`🎲   roll=[${diceRoll.join(', ')}]`);
    this.logger.log(`🎲   Previous 3 rolls: [${playerRolls[Math.max(0, currentRollIdx - 3)]?.join(', ')}, ${playerRolls[Math.max(0, currentRollIdx - 2)]?.join(', ')}, ${playerRolls[Math.max(0, currentRollIdx - 1)]?.join(', ')}]`);
    this.logger.log(`🎲   Next 3 rolls: [${playerRolls[(currentRollIdx + 1) % playerRolls.length]?.join(', ')}, ${playerRolls[(currentRollIdx + 2) % playerRolls.length]?.join(', ')}, ${playerRolls[(currentRollIdx + 3) % playerRolls.length]?.join(', ')}]`);
    
    console.log(`🎲 Provably Fair Dice: player=${isPlayer1 ? 'P1' : 'P2'}, myOffset=${myOffset}, opponentOffset=${opponentOffset}, startIdx=${startIdx}, rollCount=${rollCount}, rollIdx=${currentRollIdx}, roll=[${diceRoll.join(', ')}]`);
    
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
    // For sandbox games, player1Id can move for both sides
    const isSandboxTurn = game.type === GameType.SANDBOX && game.player1Id === playerId;
    
    if (!isBotTurn && !isSandboxTurn && currentPlayerId !== playerId) {
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

    // Если moves пустой, это пропуск хода - переключаем игрока
    if (moves.length === 0) {
      const currentState = JSON.parse(JSON.stringify(game.gameState));
      const oldCurrentPlayer = game.currentPlayer;
      currentState.dice = [];
      currentState.currentPlayer = currentState.currentPlayer === 0 ? 1 : 0;
      currentState.movesFromHead = 0;
      currentState.movesFromPoint = {};
      
      const updatedGame = await this.findOne(gameId);
      updatedGame.gameState = currentState;
      updatedGame.currentPlayer = currentState.currentPlayer;
      
      // Вычисляем время хода и обновляем lastMoveAt (ход завершен - произошла смена игрока)
      const now = new Date();
      const moveStartTime = game.lastMoveAt || game.createdAt;
      const moveTimeMs = now.getTime() - moveStartTime.getTime();
      const moveTimeSeconds = moveTimeMs / 1000;
      const baseMoveTime = 15; // 15 секунд на ход (было 20)
      const excessTime = Math.max(0, moveTimeSeconds - baseMoveTime);
      
      // Обновляем общее время игрока при завершении хода
      if (playerId && !isBotTurn) {
        const isPlayer1 = oldCurrentPlayer === 0;
        const currentPlayerTimeRemaining = isPlayer1 
          ? (updatedGame.player1TimeRemaining || 60000) 
          : (updatedGame.player2TimeRemaining || 60000);
        
        const newTimeRemaining = Math.max(0, currentPlayerTimeRemaining - (excessTime * 1000));
        
        if (isPlayer1) {
          updatedGame.player1TimeRemaining = newTimeRemaining;
        } else {
          updatedGame.player2TimeRemaining = newTimeRemaining;
        }
        
        if (game.type !== GameType.SANDBOX && newTimeRemaining <= 0) {
          updatedGame.status = GameStatus.FINISHED;
          updatedGame.winnerId = isPlayer1 ? updatedGame.player2Id : updatedGame.player1Id;
          if (updatedGame.winnerId === updatedGame.player1Id) {
            updatedGame.player1Score = 1;
            updatedGame.player2Score = 0;
          } else {
            updatedGame.player1Score = 0;
            updatedGame.player2Score = 1;
          }
        }
      }
      
      // Обновляем lastMoveAt при смене хода (ход завершен)
      updatedGame.lastMoveAt = now;
      
      return await this.gamesRepository.save(updatedGame);
    }

    // Проверяем валидность всех ходов
    let currentState = JSON.parse(JSON.stringify(game.gameState));
    // ВАЖНО: Синхронизируем currentPlayer из game в currentState перед применением ходов
    currentState.currentPlayer = game.currentPlayer;
    
    // Определяем, является ли это дублем
    const isDoubles = dice.length === 4 && dice.every(d => d === dice[0]);
    const doublesValue = isDoubles ? dice[0] : null; // Значение дубля (например, 3 для 3/3)
    
    // Для дублей создаем счетчик использования кубиков (можно использовать до 4 раз один и тот же номер)
    const diceCount = new Map<number, number>();
    for (const die of dice) {
      diceCount.set(die, (diceCount.get(die) || 0) + 1);
    }
    let totalDiceUsed = 0; // Общее количество использованных кубиков (для дублей)

    // ВАЖНО: Комбинированные ходы (die > 6) с steps НЕ разворачиваем
    // Они должны обрабатываться как один ход с steps (и для дублей, и для обычных комбинированных, например 1+6=7)
    // Разворачиваем только steps для обычных ходов, которые не являются комбинированными (die <= 6)
    const expandedMoves = [];
    for (const move of moves) {
      // Если это комбинированный ход (die > 6 и есть steps) - НЕ разворачиваем
      // Это работает и для дублей, и для обычных комбинированных ходов (например, 1+6=7)
      const isCombinedMove = move.die > 6 && (move as any).steps && Array.isArray((move as any).steps);
      if (isCombinedMove) {
        // Оставляем комбинированный ход как есть (будет обработан по шагам)
        expandedMoves.push(move);
      } else if ((move as any).steps && Array.isArray((move as any).steps)) {
        // Для обычных ходов с steps (die <= 6) разворачиваем steps
        expandedMoves.push(...(move as any).steps);
      } else {
        expandedMoves.push(move);
      }
    }

    // Нормализуем ходы с бара: фронтенд может отправлять 24 (белые) или 25 (черные) вместо -1
    const normalizedMoves = expandedMoves.map(move => {
      if (move.from === 24 || move.from === 25) {
        return { ...move, from: -1 };
      }
      return move;
    });

    // ПЕРЕПИСАННАЯ ЛОГИКА ДЛЯ ДУБЛЕЙ
    // При дубле разрешаем ходы с die равным: doublesValue, doublesValue*2, doublesValue*3, doublesValue*4
    // Для комбинированных ходов (die > doublesValue) разбиваем их на отдельные шаги
    const processedMoves: Array<{ from: number; to: number; die: number; steps?: any[] }> = [];
    
    for (const move of normalizedMoves) {
      console.log(`🔍 Валидация хода: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
      console.log(`  Текущее состояние: movesFromHead=${currentState.movesFromHead || 0}, dice=[${currentState.dice?.join(', ') || 'none'}]`);
      
      if (isDoubles && doublesValue) {
        // Для дублей проверяем, что die кратно doublesValue и не превышает 4 * doublesValue
        const allowedValues = [doublesValue, doublesValue * 2, doublesValue * 3, doublesValue * 4];
        
        if (!allowedValues.includes(move.die)) {
          throw new BadRequestException(`При дубле ${doublesValue}/${doublesValue} можно использовать только ходы на ${allowedValues.join(', ')}. Получен: ${move.die}`);
        }
        
        // Вычисляем, сколько кубиков используется для этого хода
        const diceUsedForMove = move.die / doublesValue;
        
        // Проверяем, что не превышаем лимит в 4 кубика
        if (totalDiceUsed + diceUsedForMove > 4) {
          throw new BadRequestException(`При дубле ${doublesValue}/${doublesValue} нельзя использовать более 4 кубиков. Уже использовано: ${totalDiceUsed}, требуется: ${diceUsedForMove}`);
        }
        
        // Если это комбинированный ход (die > doublesValue), применяем его по шагам
        if (move.die > doublesValue) {
          // Если есть steps - используем их для последовательного применения
          if ((move as any).steps && Array.isArray((move as any).steps) && (move as any).steps.length > 0) {
            // Применяем каждый шаг последовательно
            for (const step of (move as any).steps) {
              const isValidStep = (engine as any).validateMove(currentState, step.from, step.to, step.die, isFirstMoveOfGame);
              if (!isValidStep) {
                console.error(`❌ Шаг комбинированного хода отклонен: с индекса ${step.from} на индекс ${step.to} кубиком ${step.die}`);
                throw new BadRequestException(`Недопустимый шаг комбинированного хода: с индекса ${step.from} на индекс ${step.to} кубиком ${step.die}`);
              }
              currentState = engine.applyMove(currentState, step.from, step.to, step.die);
            }
            totalDiceUsed += diceUsedForMove;
            // Сохраняем комбинированный ход для истории (с steps)
            processedMoves.push({ from: move.from, to: move.to, die: move.die, steps: (move as any).steps });
            console.log(`✅ Применяем комбинированный ход при дубле по шагам: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die} (${(move as any).steps.length} шагов, использовано ${diceUsedForMove} кубиков из 4)`);
          } else {
            // Если steps нет, но die > doublesValue - генерируем steps и применяем последовательно
            let currentFrom = move.from;
            const steps: Array<{ from: number; to: number; die: number }> = [];
            
            for (let i = 0; i < diceUsedForMove; i++) {
              let stepTo: number;
              const gameMode = game.mode;
              const player = currentState.currentPlayer;
              
              if (gameMode === GameMode.SHORT) {
                if (player === 0) {
                  stepTo = currentFrom - doublesValue;
                  if (stepTo < 0) stepTo = -1;
                } else {
                  stepTo = currentFrom + doublesValue;
                  if (stepTo >= 24) stepTo = -1;
                }
              } else {
                if (player === 0) {
                  stepTo = (currentFrom - doublesValue + 24) % 24;
                } else {
                  stepTo = (currentFrom + doublesValue) % 24;
                }
              }
              
              const isValidStep = (engine as any).validateMove(currentState, currentFrom, stepTo, doublesValue, isFirstMoveOfGame);
              if (!isValidStep) {
                console.error(`❌ Шаг комбинированного хода отклонен: с индекса ${currentFrom} на индекс ${stepTo} кубиком ${doublesValue}`);
                throw new BadRequestException(`Недопустимый шаг комбинированного хода: с индекса ${currentFrom} на индекс ${stepTo} кубиком ${doublesValue}`);
              }
              
              steps.push({ from: currentFrom, to: stepTo, die: doublesValue });
              currentState = engine.applyMove(currentState, currentFrom, stepTo, doublesValue);
              currentFrom = stepTo;
              
              // Если дошли до выноса, останавливаемся
              if (stepTo === -1 || stepTo >= 24) break;
            }
            
            totalDiceUsed += diceUsedForMove;
            // Сохраняем комбинированный ход для истории (с сгенерированными steps)
            processedMoves.push({ from: move.from, to: move.to, die: move.die, steps: steps });
            console.log(`✅ Применяем комбинированный ход при дубле (сгенерированные шаги): с индекса ${move.from} на индекс ${move.to} кубиком ${move.die} (${steps.length} шагов, использовано ${diceUsedForMove} кубиков из 4)`);
          }
        } else {
          // Обычный ход на одно значение кубика
          const isValid = (engine as any).validateMove(currentState, move.from, move.to, move.die, isFirstMoveOfGame);
          
          if (!isValid) {
            console.error(`❌ Ход отклонен движком: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
            throw new BadRequestException(`Недопустимый ход: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
          }
          
          // Проверяем, что не превышаем лимит в 4 кубика
          if (totalDiceUsed >= 4) {
            throw new BadRequestException(`При дубле ${doublesValue}/${doublesValue} нельзя использовать более 4 кубиков`);
          }
          
          currentState = engine.applyMove(currentState, move.from, move.to, move.die);
          totalDiceUsed += 1;
          processedMoves.push({ from: move.from, to: move.to, die: move.die });
          
          console.log(`✅ Применяем ход при дубле: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die} (использовано ${totalDiceUsed}/4)`);
        }
      } else {
        // Обычная логика для не-дублей
        // Если это комбинированный ход (die > 6) с steps - применяем по шагам
        if (move.die > 6 && (move as any).steps && Array.isArray((move as any).steps) && (move as any).steps.length > 0) {
          console.log(`🔍 Processing combined move (non-doubles): die=${move.die}, steps=${(move as any).steps.length}`)
          // Применяем каждый шаг последовательно
          for (const step of (move as any).steps) {
            // Проверяем использование кубика для каждого шага
            const diceUsageCount = new Map<number, number>();
            for (const pm of processedMoves) {
              diceUsageCount.set(pm.die, (diceUsageCount.get(pm.die) || 0) + 1);
            }
            
            const usedCount = diceUsageCount.get(step.die) || 0;
            const availableCount = diceCount.get(step.die) || 0;
            
            if (usedCount >= availableCount) {
              console.error(`❌ Кубик ${step.die} уже использован максимальное количество раз (${usedCount}/${availableCount})`);
              throw new BadRequestException(`Кубик ${step.die} уже использован максимальное количество раз`);
            }
            
            const isValidStep = (engine as any).validateMove(currentState, step.from, step.to, step.die, isFirstMoveOfGame);
            if (!isValidStep) {
              console.error(`❌ Шаг комбинированного хода отклонен: с индекса ${step.from} на индекс ${step.to} кубиком ${step.die}`);
              throw new BadRequestException(`Недопустимый шаг комбинированного хода: с индекса ${step.from} на индекс ${step.to} кубиком ${step.die}`);
            }
            
            currentState = engine.applyMove(currentState, step.from, step.to, step.die);
            processedMoves.push({ from: step.from, to: step.to, die: step.die });
          }
          // Сохраняем комбинированный ход для истории (с steps)
          console.log(`✅ Применяем комбинированный ход (не дубль): с индекса ${move.from} на индекс ${move.to} кубиком ${move.die} (${(move as any).steps.length} шагов)`);
        } else {
          // Обычный одиночный ход
          const isValid = (engine as any).validateMove(currentState, move.from, move.to, move.die, isFirstMoveOfGame);
          
          if (!isValid) {
            console.error(`❌ Ход отклонен движком: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
            throw new BadRequestException(`Недопустимый ход: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
          }
          
          // Для обычных ходов проверяем использование кубика
          const diceUsageCount = new Map<number, number>();
          for (const pm of processedMoves) {
            diceUsageCount.set(pm.die, (diceUsageCount.get(pm.die) || 0) + 1);
          }
          
          const usedCount = diceUsageCount.get(move.die) || 0;
          const availableCount = diceCount.get(move.die) || 0;
          
          if (usedCount >= availableCount) {
            console.error(`❌ Кубик ${move.die} уже использован максимальное количество раз (${usedCount}/${availableCount})`);
            throw new BadRequestException(`Кубик ${move.die} уже использован максимальное количество раз`);
          }
          
          currentState = engine.applyMove(currentState, move.from, move.to, move.die);
          processedMoves.push({ from: move.from, to: move.to, die: move.die });
          
          console.log(`✅ Применяем ход: с индекса ${move.from} на индекс ${move.to} кубиком ${move.die}`);
        }
      }
    }

    // Для целей сохранения и истории используем обработанные ходы
    const finalMovesToSave = processedMoves;

    // Проверяем обязательность использования всех кубиков, если это возможно
    // getAllValidMoves доступен только для BackgammonEngine
    let allValidMoves: Array<Array<{ from: number; to: number; die: number }>> = [];
    if ('getAllValidMoves' in engine && typeof engine.getAllValidMoves === 'function') {
      allValidMoves = engine.getAllValidMoves(game.gameState, dice);
    }
    
    // Финальная проверка использования кубиков для дублей
    if (isDoubles && doublesValue) {
      if (totalDiceUsed > 4) {
        throw new BadRequestException(`При дубле использовано ${totalDiceUsed} кубиков, но доступно только 4`);
      }
    } else {
      // Для обычных ходов проверяем использование каждого кубика
      const diceUsageCount = new Map<number, number>();
      for (const move of processedMoves) {
        diceUsageCount.set(move.die, (diceUsageCount.get(move.die) || 0) + 1);
      }
      for (const [die, used] of diceUsageCount.entries()) {
        const available = diceCount.get(die) || 0;
        if (used > available) {
          throw new BadRequestException(`Кубик ${die} использован ${used} раз(а), но доступно только ${available}`);
        }
      }
    }
    
    // Для дублей разрешаем делать ходы по частям без принудительного использования всех кубиков сразу
    // Пользователь может сделать все 4 хода подряд или по частям
    const isDoublesMove = dice.length === 4 && dice.every(d => d === dice[0]);
    
    if (!isDoublesMove && allValidMoves.length > 0) {
      // Для обычных ходов проверяем, есть ли ходы, которые используют все кубики
      const fullMoves = allValidMoves.filter((moveSeq) => moveSeq.length === dice.length);
      
      // Разрешаем делать один ход за раз, если он валиден
      // Пользователь может сделать второй ход позже
      if (fullMoves.length > 0 && finalMovesToSave.length < dice.length) {
        console.log(`⚠️ Пользователь использует только ${finalMovesToSave.length} из ${dice.length} кубиков, но есть возможность использовать все`);
        // Разрешаем, но не требуем использовать все кубики
        // Пользователь может сделать второй ход позже
      }
    }

    const moveNumber = (game.moves?.length || 0) + 1;
    
    // Используем gameId параметр напрямую для надежности
    const finalGameId = game.id || gameId;
    if (!finalGameId) {
      this.logger.error(`Game ID is missing! gameId param: ${gameId}, game.id: ${game.id}, game object keys:`, Object.keys(game));
      throw new BadRequestException('Ошибка: ID игры не найден');
    }
    
    this.logger.log(`Saving move: gameId=${finalGameId}, playerId=${playerId}, moveNumber=${moveNumber}, moves count=${finalMovesToSave.length}`);
    
    // Используем репозиторий вместо raw SQL для надежности
    try {
      const newMove = this.movesRepository.create({
        gameId: finalGameId,
        playerId: playerId,
        moveNumber: moveNumber,
        dice: dice,
        moves: finalMovesToSave,
        gameStateBefore: game.gameState,
        gameStateAfter: currentState,
        moveTimeMs: moveTimeMs,
      });
      await this.movesRepository.save(newMove);
      this.logger.log(`Move saved successfully: gameId=${finalGameId}`);
    } catch (error) {
      this.logger.error(`Failed to save move:`, error);
      throw error;
    }

    // Calculate remaining dice after moves based on usage count
    // Для дублей учитываем totalDiceUsed (включая комбинированные ходы)
    const remainingDice: number[] = [];
    if (isDoubles && doublesValue) {
      // Для дублей используем totalDiceUsed вместо diceUsageCount
      const remaining = 4 - totalDiceUsed;
      for (let i = 0; i < remaining; i++) {
        remainingDice.push(doublesValue);
      }
    } else {
      // Для обычных ходов считаем использование кубиков из processedMoves
      const diceUsageCountForRemaining = new Map<number, number>();
      for (const move of processedMoves) {
        diceUsageCountForRemaining.set(move.die, (diceUsageCountForRemaining.get(move.die) || 0) + 1);
      }
      for (const [die, count] of diceCount.entries()) {
        const used = diceUsageCountForRemaining.get(die) || 0;
        const remaining = count - used;
        for (let i = 0; i < remaining; i++) {
          remainingDice.push(die);
        }
      }
    }
    
    if (remainingDice.length === 0) {
      // Все кубики использованы - смена хода
      currentState.dice = [];
      currentState.currentPlayer = currentState.currentPlayer === 0 ? 1 : 0;
      currentState.movesFromHead = 0;
      currentState.movesFromPoint = {};
      this.logger.log(`🔄 Turn switched: all dice used. New player: ${currentState.currentPlayer}`);
    } else {
      // ОБЯЗАТЕЛЬНАЯ проверка: есть ли валидные ходы с оставшимися кубиками после применения всех ходов
      let hasValidMoves = false;
      
      // ВСЕГДА проверяем валидные ходы для всех режимов (и длинных, и коротких нард)
      if ('getAllValidMoves' in engine && typeof engine.getAllValidMoves === 'function') {
        // Проверяем валидность ходов с текущим состоянием после применения всех ходов
        const remainingMoves = engine.getAllValidMoves(currentState, remainingDice, isFirstMoveOfGame);
        // getAllValidMoves возвращает последовательности. Если есть хотя бы одна непустая - ходы есть.
        hasValidMoves = remainingMoves.length > 0 && remainingMoves.some(seq => seq.length > 0);
        this.logger.log(`🔍 Checking remaining moves after ${finalMovesToSave.length} moves: dice=[${remainingDice.join(', ')}], hasValidMoves=${hasValidMoves}, movesFound=${remainingMoves.length}`);
        
        if (hasValidMoves) {
          // Есть еще ходы - оставляем того же игрока
          currentState.dice = remainingDice;
          this.logger.log(`🟡 Keeping same player: valid moves remain with dice [${remainingDice.join(', ')}]`);
        } else {
          // Ходов больше нет - ПРИНУДИТЕЛЬНАЯ смена хода
          currentState.dice = [];
          currentState.currentPlayer = currentState.currentPlayer === 0 ? 1 : 0;
          currentState.movesFromHead = 0;
          currentState.movesFromPoint = {};
          this.logger.log(`🔄 Turn switched: no valid moves remain with [${remainingDice.join(', ')}]. New player: ${currentState.currentPlayer}`);
        }
      } else {
        // Если нет метода getAllValidMoves, НЕ оставляем кубики - переключаем ход (безопаснее)
        currentState.dice = [];
        currentState.currentPlayer = currentState.currentPlayer === 0 ? 1 : 0;
        currentState.movesFromHead = 0;
        currentState.movesFromPoint = {};
        this.logger.log(`🔄 Turn switched: no getAllValidMoves method available, switching turn for safety`);
      }
    }
    
    // Перезагружаем игру чтобы TypeORM знал о новом ходе и не пытался синхронизировать relations
    const updatedGame = await this.findOne(gameId);
    const oldCurrentPlayer = updatedGame.currentPlayer; // Сохраняем старый игрока для проверки смены хода
    
    // ВАЖНО: Сохраняем новое состояние ПОСЛЕ перезагрузки, чтобы не потерять изменения
    // Используем глубокую копию, чтобы избежать проблем с ссылками
    updatedGame.gameState = JSON.parse(JSON.stringify(currentState));
    updatedGame.currentPlayer = currentState.currentPlayer;
    
    // Вычисляем время, затраченное на ход (ДО обновления lastMoveAt)
    const now = new Date();
    const moveStartTime = game.lastMoveAt || game.createdAt;
    const moveTimeMs = now.getTime() - moveStartTime.getTime();
    
    // Проверяем, произошла ли смена хода
    const turnChanged = oldCurrentPlayer !== currentState.currentPlayer;
    
    // Обновляем общее время игрока только когда ход полностью завершен (произошла смена хода)
    // Таймер считается до полного окончания хода, а не до промежуточного подтверждения
    if (turnChanged && !isBotTurn && playerId) {
      const moveTimeSeconds = moveTimeMs / 1000;
      const baseMoveTime = 15; // 15 секунд на ход (было 20)
      const excessTime = Math.max(0, moveTimeSeconds - baseMoveTime); // Превышение 15 секунд
      
      // Определяем, какой игрок завершил ход (это был предыдущий currentPlayer)
      const isPlayer1 = oldCurrentPlayer === 0;
      const currentPlayerTimeRemaining = isPlayer1 
        ? (updatedGame.player1TimeRemaining || 60000) 
        : (updatedGame.player2TimeRemaining || 60000);
      
      // Вычитаем превышение из общего времени (превышение в секундах, конвертируем в миллисекунды)
      const newTimeRemaining = Math.max(0, currentPlayerTimeRemaining - (excessTime * 1000));
      
      if (isPlayer1) {
        updatedGame.player1TimeRemaining = newTimeRemaining;
      } else {
        updatedGame.player2TimeRemaining = newTimeRemaining;
      }
      
      this.logger.log(`⏱️ Player ${oldCurrentPlayer === 0 ? updatedGame.player1Id : updatedGame.player2Id} move completed: ${moveTimeSeconds.toFixed(2)}s (excess: ${excessTime.toFixed(2)}s), remaining: ${(newTimeRemaining / 1000).toFixed(2)}s`);
      
      // Если общее время закончилось, завершаем игру
      if (game.type !== GameType.SANDBOX && newTimeRemaining <= 0) {
        this.logger.warn(`⏱️ Player ${oldCurrentPlayer === 0 ? updatedGame.player1Id : updatedGame.player2Id} ran out of total time (${excessTime.toFixed(2)}s excess)`);
        // Завершаем игру в пользу противника
        updatedGame.status = GameStatus.FINISHED;
        updatedGame.winnerId = isPlayer1 ? updatedGame.player2Id : updatedGame.player1Id;
        if (updatedGame.winnerId === updatedGame.player1Id) {
          updatedGame.player1Score = 1;
          updatedGame.player2Score = 0;
        } else {
          updatedGame.player1Score = 0;
          updatedGame.player2Score = 1;
        }
      }
      
      // Обновляем lastMoveAt только при смене хода (когда ход полностью завершен)
      updatedGame.lastMoveAt = now;
    }
    // Если ход не завершен (промежуточное подтверждение), lastMoveAt НЕ обновляется

    // Если это первый ход (игра в статусе WAITING), переводим в IN_PROGRESS
    if (updatedGame.status === GameStatus.WAITING) {
      updatedGame.status = GameStatus.IN_PROGRESS;
      // Устанавливаем lastMoveAt при первом переходе в IN_PROGRESS для работы таймера
      if (!updatedGame.lastMoveAt) {
        updatedGame.lastMoveAt = now;
      }
    }

    // В свободном столе игра никогда не заканчивается автоматически
    if (game.type !== GameType.SANDBOX && engine.isGameFinished(currentState)) {
      const winner = engine.getWinner(currentState);
      updatedGame.status = GameStatus.FINISHED;
      if (winner === 0) {
        updatedGame.winnerId = updatedGame.player1Id;
      } else if (winner === 1) {
        // Для игр с ботом player2Id равен null, но winnerId должен быть установлен
        // Если winner === 1 (бот победил), winnerId = null (явное указание, что игрок проиграл)
        // Для обычных игр winnerId = player2Id
        updatedGame.winnerId = updatedGame.player2Id || null;
      }
      
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
        updatedGame.player2Score = 0;
      } else if (winner === 1) {
        updatedGame.player1Score = 0;
        updatedGame.player2Score = 1;
      }
    }

    let savedGame = await this.gamesRepository.save(updatedGame);

    // Применяем логику после завершения игры (после сохранения)
    if (savedGame.status === GameStatus.FINISHED) {
      await this.onGameFinished(savedGame);
      // Перезагружаем игру, чтобы получить обновленные данные (например, player1XP, player2XP)
      savedGame = await this.findOne(gameId);
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
    
    // В sandbox режиме только player1Id может делать ходы за обе стороны
    const isSandboxTurn = game.type === GameType.SANDBOX && game.player1Id === playerId;
    
    if (!isSandboxTurn && currentPlayerId !== playerId) {
      throw new BadRequestException('Не ваш ход');
    }

    const engine = game.mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    let state = game.gameState;
    
    // ВАЖНО: Синхронизируем currentPlayer из сущности Game в gameState
    // Это критично для корректной работы движка в sandbox режиме
    if (state && state.currentPlayer !== game.currentPlayer) {
      state = { ...state, currentPlayer: game.currentPlayer };
    }
    
    // Определяем, является ли этот ход первым в игре для этого режима (Long)
    const isFirstMoveOfGame = game.mode === GameMode.LONG && (game.moves || []).length < 2;

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
        } else {
          // 3. Или ищем сумму кубиков (fallback для обоих режимов)
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
    let diceForMoves = remainingDice;

    if (!diceForMoves || diceForMoves.length === 0) {
      return { allMoves: [] };
    }

    // Получаем все возможные комбинации ходов ТОЛЬКО с оставшимися кубиками
    let allMoves: Array<Array<{ from: number; to: number; die: number }>> = [];
    if ('getAllValidMoves' in engine && typeof engine.getAllValidMoves === 'function') {
      // Важно: для дублей передаем только первые 2 кубика (если нет pendingMoves)
      allMoves = engine.getAllValidMoves(state, diceForMoves, isFirstMoveOfGame);
    }
    
    // Преобразуем последовательности в плоский список доступных ходов,
    // включая комбинированные ходы (сумма нескольких кубиков) для одной шашки
    const flatMoves: Array<{ from: number; to: number; die: number; steps?: any[] }> = [];
    const seen = new Set<string>();
    
    // Получаем список доступных кубиков для фильтрации (используем ограниченные кубики для дублей)
    const availableDice = diceForMoves;
    const diceCounts = new Map<number, number>();
    availableDice.forEach(d => diceCounts.set(d, (diceCounts.get(d) || 0) + 1));
    
    // ВАЖНО: Для дублей добавляем комбинированные ходы (одна шашка на все 4 кубика)
    // Например, при дубле 3/3: можно походить на 3, 6, 9, 12 одной шашкой
    const isDoublesForCombined = availableDice.length === 4 && availableDice.every(d => d === availableDice[0]);
    const doublesValue = isDoublesForCombined ? availableDice[0] : null;

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
    
    // ВАЖНО: Для дублей добавляем комбинированные ходы (одна шашка на все 4 кубика)
    // Например, при дубле 3/3: можно походить на 3, 6, 9, 12 одной шашкой
    if (isDoublesForCombined && doublesValue) {
      // Получаем все уникальные точки, с которых можно ходить
      const fromPoints = new Set<number>();
      for (const move of flatMoves) {
        fromPoints.add(move.from);
      }
      
      // Для каждой точки генерируем комбинированные ходы: doublesValue, doublesValue*2, doublesValue*3, doublesValue*4
      for (const fromPoint of fromPoints) {
        // Проверяем все возможные комбинированные ходы для этой точки
        for (let multiplier = 2; multiplier <= 4; multiplier++) {
          const combinedDie = doublesValue * multiplier;
          
          // Вычисляем целевую точку для комбинированного хода
          const player = state.currentPlayer;
          let toPoint: number;
          
          const gameMode = game.mode;
          if (gameMode === GameMode.SHORT) {
            // Для коротких нард
            if (player === 0) {
              // Белые идут от 23 к 0
              toPoint = fromPoint - combinedDie;
              if (toPoint < 0) {
                // Вынос
                toPoint = -1;
              }
            } else {
              // Черные идут от 0 к 23
              toPoint = fromPoint + combinedDie;
              if (toPoint >= 24) {
                // Вынос
                toPoint = -1;
              }
            }
          } else {
            // Для длинных нард
            if (player === 0) {
              // Белые идут по часовой стрелке
              toPoint = (fromPoint - combinedDie + 24) % 24;
            } else {
              // Черные идут против часовой стрелки
              toPoint = (fromPoint + combinedDie) % 24;
            }
          }
          
          // Проверяем валидность комбинированного хода
          const isValid = (engine as any).validateMove(state, fromPoint, toPoint, combinedDie, isFirstMoveOfGame);
          
          if (isValid) {
            // Генерируем steps для комбинированного хода
            const steps: Array<{ from: number; to: number; die: number }> = [];
            let currentFrom = fromPoint;
            
            for (let i = 0; i < multiplier; i++) {
              let stepTo: number;
              
              if (gameMode === GameMode.SHORT) {
                if (player === 0) {
                  stepTo = currentFrom - doublesValue;
                  if (stepTo < 0) stepTo = -1;
                } else {
                  stepTo = currentFrom + doublesValue;
                  if (stepTo >= 24) stepTo = -1;
                }
              } else {
                if (player === 0) {
                  stepTo = (currentFrom - doublesValue + 24) % 24;
                } else {
                  stepTo = (currentFrom + doublesValue) % 24;
                }
              }
              
              steps.push({ from: currentFrom, to: stepTo, die: doublesValue });
              currentFrom = stepTo;
              
              // Если дошли до выноса, останавливаемся
              if (stepTo === -1 || stepTo >= 24) break;
            }
            
            const key = `${fromPoint}-${toPoint}-${combinedDie}`;
            if (!seen.has(key)) {
              flatMoves.push({
                from: fromPoint,
                to: toPoint,
                die: combinedDie,
                steps: steps
              });
              seen.add(key);
            }
          }
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

    // Для игр с ботом: winnerId может быть null, если бот победил (это поражение игрока)
    const gameType: GameType = game.type;
    
    // Skip rewards for sandbox games
    if (gameType === GameType.SANDBOX) {
      this.logger.log(`🎮 Песочница ${game.id} завершена, награды не начисляются`);
      return;
    }
    
    let loserId: string | null = null;
    
    if (game.winnerId) {
      // Игрок победил
      loserId = game.winnerId === game.player1Id ? game.player2Id : game.player1Id;
    } else if (gameType === GameType.VS_BOT) {
      // Бот победил (winnerId === null) - это поражение игрока
      loserId = game.player1Id;
      this.logger.log(`🎮 Бот победил в игре ${game.id}, игрок ${game.player1Id} проиграл`);
    } else {
      // Для других типов игр должен быть winnerId
      this.logger.warn(`⚠️ Игра ${game.id} завершена, но нет winnerId и это не игра с ботом`);
      return;
    }
    
    // Проверяем, что есть проигравший (для игр с игроками)
    if (gameType === GameType.VS_PLAYER && !loserId) {
      this.logger.warn(`⚠️ Игра ${game.id} типа VS_PLAYER, но нет loserId`);
      return;
    }
    
    // Для игр с ботом: если winnerId === null, значит бот победил, игрок проиграл
    const actualWinnerId = game.winnerId || (gameType === GameType.VS_BOT ? null : game.winnerId);
    this.logger.log(`🎮 Обработка наград: winnerId=${actualWinnerId}, loserId=${loserId}, stake=${game.stake}, type=${gameType}`);

    // Обработка ставок - победитель получает обе ставки (с учетом комиссии)
    if (game.stake > 0 && game.type === GameType.VS_PLAYER && game.winnerId && loserId) {
      try {
        const stake = Number(game.stake);
        const totalPot = stake * 2;
        
        // Получаем пользователя и бонусы от скинов для денег
        const winnerUser = await this.usersService.findOne(game.winnerId);
        const winnerBonuses = await this.skinsService.getSkinBonuses(game.winnerId);
        
        // Рассчитываем динамическую комиссию на основе прокачки Экономики
        const winnerEconSp = winnerUser.economySp || 0;
        const gearCommissionBonus = (winnerBonuses.bonuses?.commissionReduction || 0); 
        const commissionRate = this.branchesService.calculateFinalCommission(winnerEconSp, gearCommissionBonus);
        const finalCommission = Math.floor(totalPot * commissionRate);
        
        const winnerReward = totalPot - finalCommission;
        const moneyBonus = Math.floor(winnerReward * (winnerBonuses.moneyBonusPercent / 100));
        const finalWinnerReward = winnerReward + moneyBonus;
        
        const winnerBalance = Number(winnerUser.narCoin);
        const newWinnerBalance = winnerBalance + finalWinnerReward;
        await this.usersService.update(game.winnerId, { narCoin: newWinnerBalance });
        
        // Пополняем казну города комиссией
        await this.progressService.addToCityTreasury(finalCommission);
        
        this.logger.log(`💰 Награда начислена победителю ${game.winnerId}: +${finalWinnerReward} NAR (базовая: ${winnerReward}, бонус: ${moneyBonus} (${winnerBonuses.moneyBonusPercent}%), комиссия: ${Math.round(commissionRate * 100)}%), было ${winnerBalance}, стало ${newWinnerBalance}, комиссия в казну: ${finalCommission} NAR`);
      } catch (error) {
        this.logger.error(`❌ Ошибка при начислении ставки: ${error.message}`, error.stack);
      }
    }

    // Начисление опыта по новой системе с множителями
    // Для игр с игроками
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
        
        // Сохраняем начисленный XP в игру
        if (game.winnerId === game.player1Id) {
          game.player1XP = winnerXP;
          game.player2XP = loserXP;
        } else {
          game.player1XP = loserXP;
          game.player2XP = winnerXP;
        }
        
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
        
        // Сохраняем игру с обновленным player1XP и player2XP
        await this.gamesRepository.save(game);
      } catch (error) {
        this.logger.error(`❌ Ошибка при начислении XP: ${error.message}`, error.stack);
      }
    }
    
    // Начисление опыта для игр с ботом
    if (game.type === GameType.VS_BOT && game.player1Id) {
      try {
        const playerId = game.player1Id;
        const isWinner = game.winnerId === playerId;
        
        // Для игр с ботом используем фиксированный рейтинг бота (средний уровень)
        const playerRating = await this.ratingsService.getRating(playerId, game.mode) || 1000;
        const botRating = 1000; // Средний рейтинг бота
        
        // Получаем бонусы от скинов игрока
        const playerBonuses = await this.skinsService.getSkinBonuses(playerId);
        const playerItemsXPBonus = [playerBonuses.xpBonusPercent / 100];
        
        // Проверяем "Марс" (разгромная победа - противник не вывел ни одной шашки)
        const isMarsWin = this.isMarsWin(game);
        
        // Начисляем XP только за победу в играх с ботом
        if (isWinner) {
          // Рассчитываем XP для игрока (только при победе)
          const playerXP = this.xpCalculator.calculateXP({
            mode: game.mode,
            gameType: GameType.VS_BOT,
            playerWon: true,
            playerRating: playerRating,
            opponentRating: botRating,
            repeatMatchesCount: 1, // Игры с ботом не учитываются для анти-фарма
            itemsXPBonus: playerItemsXPBonus,
            isMarsWin: isMarsWin,
            trustLevel: 'high',
            stake: 0, // Игры с ботом без ставок
          });
          
          // Начисляем XP только за победу
          const playerResult = await this.progressService.addXP(playerId, playerXP);
          game.player1XP = playerXP;
          
          this.logger.log(`⭐ XP начислен игроку ${playerId} за победу в игре с ботом: +${playerXP} XP (Марс: ${isMarsWin})`);
          
          // Если уровень повысился, логируем
          if (playerResult.levelUp && playerResult.newLevel) {
            this.logger.log(`🎉 Игрок ${playerId} повысил уровень до ${playerResult.newLevel} в игре с ботом!`);
          }
        } else {
          // При поражении опыт не начисляется
          game.player1XP = 0;
          this.logger.log(`⭐ Игрок ${playerId} проиграл игре с ботом - опыт не начисляется`);
        }
        
        // Тратим энергию при завершении матча (бот-игры не тратят энергию согласно спецификации)
        // Пропускаем трату энергии для игр с ботом
        
        // Не тратим жизни при поражении от бота
        // Обновление истории матчей для анти-фарма не требуется для игр с ботом
        
        // Обновляем прогресс заданий обучения
        try {
          await this.trainingService.updateTaskProgress(playerId, TaskType.PLAY_GAME, 1);
          if (isWinner) {
            await this.trainingService.updateTaskProgress(playerId, TaskType.WIN_GAME, 1);
          }
        } catch (error) {
          this.logger.error(`❌ Ошибка при обновлении заданий обучения: ${error.message}`);
        }
      } catch (error) {
        this.logger.error(`❌ Ошибка при начислении XP за игру с ботом: ${error.message}`, error.stack);
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

    // Проверка и создание следующей игры в серии матчей
    if (game.matchesToWin > 1 && game.matchSeriesId && game.winnerId && loserId && game.type === GameType.VS_PLAYER) {
      try {
        // Обновляем счет побед в текущей игре
        const player1Won = game.winnerId === game.player1Id;
        const newPlayer1Wins = game.player1Wins + (player1Won ? 1 : 0);
        const newPlayer2Wins = game.player2Wins + (player1Won ? 0 : 1);

        // Обновляем счет в текущей игре
        game.player1Wins = newPlayer1Wins;
        game.player2Wins = newPlayer2Wins;
        await this.gamesRepository.save(game);

        // Проверяем, достиг ли кто-то нужного количества побед
        const winnerReachedTarget = player1Won 
          ? newPlayer1Wins >= game.matchesToWin 
          : newPlayer2Wins >= game.matchesToWin;

        if (!winnerReachedTarget) {
          // Создаем следующую игру в серии (без списания ставки - она уже списана)
          this.logger.log(`🎮 Создание следующей игры в серии ${game.matchSeriesId}. Счет: ${newPlayer1Wins}:${newPlayer2Wins} (до ${game.matchesToWin})`);
          
          const nextGame = await this.create(
            game.player1Id,
            game.player2Id,
            game.mode,
            game.type,
            game.stake, // Передаем ставку, но не будем списывать повторно
            0, // moveTimeLimit - используем стандартный
            game.matchesToWin,
            game.matchSeriesId, // Используем тот же matchSeriesId
            newPlayer1Wins,
            newPlayer2Wins,
          );

          // НЕ списываем ставку повторно - она уже была списана при создании первой игры
          // Убираем списание ставки из созданной игры (возвращаем балансы)
          if (game.stake > 0 && nextGame.id) {
            const player1 = await this.usersService.findOne(game.player1Id);
            const player2 = await this.usersService.findOne(game.player2Id);
            
            // Возвращаем списанные ставки (они были списаны в create)
            const player1Balance = Number(player1.narCoin);
            const player2Balance = Number(player2.narCoin);
            
            await this.usersService.update(game.player1Id, { narCoin: player1Balance + game.stake });
            await this.usersService.update(game.player2Id, { narCoin: player2Balance + game.stake });
            
            this.logger.log(`💰 Ставки возвращены для следующей игры в серии (игроки: ${game.player1Id}, ${game.player2Id}, сумма: ${game.stake})`);
          }

          // Уведомляем игроков через WebSocket
          this.gamesGateway.server?.to(`game:${game.id}`).emit('next_game_created', {
            gameId: nextGame.id,
            matchSeriesId: game.matchSeriesId,
            player1Wins: newPlayer1Wins,
            player2Wins: newPlayer2Wins,
            matchesToWin: game.matchesToWin,
          });
          
          this.logger.log(`✅ Следующая игра в серии создана: ${nextGame.id}`);
        } else {
          this.logger.log(`🏆 Серия матчей ${game.matchSeriesId} завершена. Победитель: ${game.winnerId} (${newPlayer1Wins}:${newPlayer2Wins})`);
        }
      } catch (error) {
        this.logger.error(`❌ Ошибка при создании следующей игры в серии: ${error.message}`, error.stack);
      }
    }
    
    this.logger.log(`✅ onGameFinished завершен для игры ${game.id}`);
  }

  /**
   * Сдача игры игроком
   */
  async updatePlayerTotalTime(gameId: string, playerIndex: number, newTimeMs: number): Promise<void> {
    const game = await this.findOne(gameId);
    if (playerIndex === 0) {
      game.player1TimeRemaining = newTimeMs;
    } else {
      game.player2TimeRemaining = newTimeMs;
    }
    await this.gamesRepository.save(game);
  }

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
      let winnerId = game.player1Id === playerId ? game.player2Id : game.player1Id;
      
      // Для игр с ботом winnerId может быть null (если игрок сдается боту)
      if (!winnerId && game.type !== GameType.VS_BOT) {
        throw new BadRequestException('Невозможно сдать игру без противника');
      }

      // Завершаем игру с поражением вышедшего
      game.status = GameStatus.FINISHED;
      game.winnerId = winnerId; // В игре с ботом это будет null, что означает победу бота
      
      if (winnerId === game.player1Id) {
        game.player1Score = 1;
        game.player2Score = 0;
      } else {
        game.player1Score = 0;
        game.player2Score = 1;
      }

      let savedGame = await this.gamesRepository.save(game);

      // Применяем логику после завершения игры (награды, рейтинги)
      await this.onGameFinished(savedGame);
      
      // Перезагружаем игру, чтобы получить обновленные данные (например, player1XP, player2XP)
      savedGame = await this.findOne(gameId);

      return savedGame;
    }

    // Если статус неожиданный, просто возвращаем игру
    return game;
  }

  /**
   * Завершить игру с ботом при таймауте игрока
   * Используется когда игрок не сделал ход в течение 20 секунд
   */
  async finishBotGameOnTimeout(gameId: string): Promise<Game> {
    const game = await this.findOne(gameId);
    
    if (game.status !== GameStatus.IN_PROGRESS) {
      this.logger.warn(`⚠️ Игра ${gameId} уже завершена или не в статусе IN_PROGRESS, статус: ${game.status}`);
      return game;
    }
    
    if (game.type !== GameType.VS_BOT || game.player2Id !== null) {
      throw new BadRequestException('Метод finishBotGameOnTimeout может использоваться только для игр с ботом');
    }
    
    // Определяем победителя на основе того, чье время истекло
    if (game.currentPlayer === 0) {
      // Игрок (белые) проиграл по времени, бот победил
      game.winnerId = null; // null означает победу бота
      game.player1Score = 0;
      game.player2Score = 1;
      this.logger.log(`⏱️ Игрок (P1) проиграл боту по времени в игре ${gameId}`);
    } else {
      // Бот (черные) проиграл по времени, игрок победил
      game.winnerId = game.player1Id;
      game.player1Score = 1;
      game.player2Score = 0;
      this.logger.log(`⏱️ Бот (P2) проиграл игроку по времени в игре ${gameId}`);
    }
    
    game.status = GameStatus.FINISHED;
    const savedGame = await this.gamesRepository.save(game);
    
    // Применяем логику после завершения игры (награды, рейтинги)
    await this.onGameFinished(savedGame);
    
    // Перезагружаем игру, чтобы получить обновленные данные
    return await this.findOne(gameId);
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
      // Фильтруем только действительно активные игры (исключаем игры с ботом и sandbox)
      const trulyActivePlayer1Games = player1ActiveGames.filter(game => 
        (game.status === GameStatus.WAITING || game.status === GameStatus.IN_PROGRESS) &&
        game.type !== GameType.VS_BOT &&
        game.type !== GameType.SANDBOX
      );
      if (trulyActivePlayer1Games.length > 0) {
        throw new BadRequestException('Вы уже находитесь в активной игре. Завершите текущую игру перед созданием новой.');
      }

      // Проверка энергии для игр с ботом не требуется (бот-игры не тратят энергию)
      // Проверка жизней для игр с ботом не требуется

      const rngSeed = crypto.randomBytes(32).toString('hex');
      const verificationSalt = crypto.randomBytes(16).toString('hex');

      const engine = gameMode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
      const initialState = engine.createInitialState();

      // Игра с ботом создается в WAITING, переходит в IN_PROGRESS после выбора смещения
      // Для бота автоматически устанавливаем смещение 1 (по умолчанию)
      const now = new Date();
      const game = this.gamesRepository.create({
        player1Id: playerId,
        player2Id: null, // Бот не имеет player2Id
        mode: gameMode,
        type: GameType.VS_BOT,
        stake: 0, // Игры с ботом без ставок
        status: GameStatus.WAITING, // Ждем выбора смещения игроком
        gameState: initialState,
        rngSeed,
        rngHash: null, // Будет установлен после генерации бросков
        p1Rolls: null, // Будет сгенерировано после выбора смещения
        p2Rolls: null, // Будет сгенерировано после выбора смещения
        verificationSalt,
        p1Offset: 1,
        p2Offset: 1, // Для бота смещение по умолчанию
        p1OffsetChosenAt: null, // Игрок еще не выбрал
        p2OffsetChosenAt: now, // Бот автоматически выбирает смещение 1
        currentPlayer: 0,
        moveTimeLimit: 60000,
        player1TimeRemaining: 60000, // 60 секунд общего времени
        player2TimeRemaining: 60000, // 60 секунд общего времени (бот не использует, но для совместимости)
        lastMoveAt: undefined, // Устанавливается когда игра переходит в IN_PROGRESS
      });

      const savedGame = await this.gamesRepository.save(game);
      
      this.logger.log(`🤖 Создана игра с ИИ: gameId=${savedGame.id}, playerId=${playerId}, mode=${gameMode}. Ожидание выбора смещения игроком.`);

      return savedGame;
    } catch (error) {
      this.logger.error(`❌ Ошибка при создании игры с ботом для playerId=${playerId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при создании игры: ${error.message || 'Неизвестная ошибка'}`);
    }
  }

  async createSandboxGame(playerId: string, mode?: GameMode): Promise<Game> {
    try {
      const gameMode = mode || GameMode.LONG;
      
      const rngSeed = crypto.randomBytes(32).toString('hex');
      const verificationSalt = crypto.randomBytes(16).toString('hex');

      // Создаем пустое состояние доски для свободного стола
      // Все шашки находятся в bearOff (лот), откуда их можно брать для расстановки
      const emptyState = {
        points: Array(24).fill(0), // Все точки пустые
        bar: [0, 0], // Бар пустой
        borneOff: [15, 15], // Вынос заполнен: 15 белых и 15 черных шашек
        currentPlayer: 0,
        dice: [], // Кубики не брошены
        ...(gameMode === GameMode.LONG ? {
          movesFromHead: 0,
          movesFromPoint: {},
        } : {
          canDouble: true,
          cubeValue: 1,
          cubeOwner: -1,
        }),
      };

      // Для песочницы автоматически устанавливаем смещения для обоих "игроков"
      const now = new Date();
      const game = this.gamesRepository.create({
        player1Id: playerId,
        player2Id: null,
        mode: gameMode,
        type: GameType.SANDBOX,
        stake: 0,
        status: GameStatus.WAITING, // Ждем выбора смещения (хотя для песочницы это формальность)
        gameState: emptyState,
        rngSeed,
        rngHash: null, // Будет установлен после генерации бросков
        p1Rolls: null, // Будет сгенерировано после выбора смещения
        p2Rolls: null, // Будет сгенерировано после выбора смещения
        verificationSalt,
        p1Offset: 1,
        p2Offset: 1, // Для второго игрока в песочнице смещение по умолчанию
        p1OffsetChosenAt: null, // Игрок еще не выбрал
        p2OffsetChosenAt: now, // Автоматически выбираем смещение для второго игрока
        currentPlayer: 0,
        moveTimeLimit: 0, // No time limit for sandbox
        player1TimeRemaining: 3600000, // 1 hour
        player2TimeRemaining: 3600000,
        lastMoveAt: undefined, // Устанавливается когда игра переходит в IN_PROGRESS
      });

      const savedGame = await this.gamesRepository.save(game);
      
      this.logger.log(`🎮 Свободный стол создан: gameId=${savedGame.id}, playerId=${playerId}, mode=${gameMode}. Ожидание выбора смещения.`);

      return savedGame;
    } catch (error) {
      this.logger.error(`❌ Ошибка при создании свободного стола для playerId=${playerId}:`, error);
      throw new BadRequestException(`Ошибка при создании игры: ${error.message || 'Неизвестная ошибка'}`);
    }
  }

  async getGameState(gameId: string): Promise<any> {
    const game = await this.findOne(gameId);
    
    // ВАЖНО: Включаем все данные для восстановления сессии с сервера
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
      player1Wins: game.player1Wins || 0,
      player2Wins: game.player2Wins || 0,
      matchesToWin: game.matchesToWin || 1,
      winnerId: game.winnerId,
      rngHash: game.rngHash,
      p1Offset: game.p1Offset,
      p2Offset: game.p2Offset,
      p1OffsetChosenAt: game.p1OffsetChosenAt,
      p2OffsetChosenAt: game.p2OffsetChosenAt,
      verificationSalt: game.status === GameStatus.FINISHED ? game.verificationSalt : undefined,
      p1Rolls: game.status === GameStatus.FINISHED ? game.p1Rolls : undefined,
      p2Rolls: game.status === GameStatus.FINISHED ? game.p2Rolls : undefined,
      player1XP: game.player1XP || null,
      player2XP: game.player2XP || null,
      player1TimeRemaining: game.player1TimeRemaining || 60000,
      player2TimeRemaining: game.player2TimeRemaining || 60000,
      lastMoveAt: game.lastMoveAt,
      moveTimeLimit: game.moveTimeLimit || 60000,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
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

    if (offset < 1 || offset > 5) {
      throw new BadRequestException('Смещение должно быть от 1 до 5');
    }

    const now = new Date();
    if (game.player1Id === playerId) {
      game.p1Offset = offset;
      game.p1OffsetChosenAt = now;
    } else if (game.player2Id === playerId) {
      game.p2Offset = offset;
      game.p2OffsetChosenAt = now;
    } else {
      throw new BadRequestException('Вы не участник этой игры');
    }

    // Проверяем, выбрали ли оба игрока смещение
    // Смещение считается выбранным, если установлено время выбора (p1OffsetChosenAt/p2OffsetChosenAt)
    const p1OffsetChosen = game.p1OffsetChosenAt !== null;
    const p2OffsetChosen = game.p2OffsetChosenAt !== null;

    // Если оба игрока выбрали смещение, ГЕНЕРИРУЕМ броски кубиков и переводим игру в IN_PROGRESS
    // Это работает для ВСЕХ типов игр (обычные, бот, песочница)
    if (p1OffsetChosen && p2OffsetChosen && game.status === GameStatus.WAITING) {
      // ГЕНЕРАЦИЯ СЛУЧАЙНОЙ последовательности бросков кубиков
      // Последовательность случайная и НЕ зависит от смещений
      // Смещения определяют только СТАРТОВУЮ ПОЗИЦИЮ в этой последовательности
      const engine = game.mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
      
      // Генерируем СЛУЧАЙНУЮ последовательность используя rngSeed игры
      // Для каждого игрока своя случайная последовательность
      const p1RollsSeed = `${game.rngSeed}_p1`;
      const p2RollsSeed = `${game.rngSeed}_p2`;
      
      const generateRolls = (seed: string) => {
        const rng = engine.createSeededRNG(seed);
        const rolls = [];
        for (let i = 0; i < 1000; i++) {
          const die1 = Math.floor(rng() * 6) + 1;
          const die2 = Math.floor(rng() * 6) + 1;
          rolls.push([die1, die2]);
        }
        return rolls;
      };

      const p1Rolls = generateRolls(p1RollsSeed);
      const p2Rolls = generateRolls(p2RollsSeed);

      // Хешируем последовательности для контроля честности
      const p1Hash = crypto.createHash('sha256').update(JSON.stringify(p1Rolls) + game.verificationSalt).digest('hex');
      const p2Hash = crypto.createHash('sha256').update(JSON.stringify(p2Rolls) + game.verificationSalt).digest('hex');
      const rngHash = JSON.stringify({ p1Hash, p2Hash });

      // Сохраняем сгенерированные броски и хеш
      game.p1Rolls = p1Rolls;
      game.p2Rolls = p2Rolls;
      game.rngHash = rngHash;

      // Определяем первого ходящего через начальный бросок кубиков
      const p1StartIdx = ((game.p1Offset - 1) * 2 + game.p2Offset) % p1Rolls.length;
      const p2StartIdx = ((game.p2Offset - 1) * 2 + game.p1Offset) % p2Rolls.length;
      
      const p1FirstRoll = p1Rolls[p1StartIdx];
      const p2FirstRoll = p2Rolls[p2StartIdx];
      
      // Определяем кто ходит первым по сумме кубиков
      const sum1 = p1FirstRoll[0] + p1FirstRoll[1];
      const sum2 = p2FirstRoll[0] + p2FirstRoll[1];
      
      // Если суммы равны, выбираем player1
      const firstPlayer = sum1 >= sum2 ? 0 : 1;
      
      game.status = GameStatus.IN_PROGRESS;
      game.currentPlayer = firstPlayer;
      game.lastMoveAt = now;
      
      // Инициализируем gameState если его еще нет
      if (!game.gameState) {
        const engine = game.mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
        game.gameState = engine.createInitialState();
      }
      
      // Обновляем currentPlayer в gameState
      game.gameState.currentPlayer = firstPlayer;
      
      this.logger.log(`Game ${game.id} started after offset selection. P1: [${p1FirstRoll.join(', ')}] (sum=${sum1}), P2: [${p2FirstRoll.join(', ')}] (sum=${sum2}). First player: ${firstPlayer === 0 ? 'P1' : 'P2'}`);
    }

    const savedGame = await this.gamesRepository.save(game);
    
    // Если игра только что началась, делаем первый бросок кубиков для первого игрока
    // Это работает для ВСЕХ типов игр (обычные, бот, песочница)
    if (p1OffsetChosen && p2OffsetChosen && savedGame.status === GameStatus.IN_PROGRESS && savedGame.gameState && !savedGame.gameState.dice?.length) {
      try {
        // Определяем ID первого игрока
        // Для игр с ботом player2Id = null, поэтому используем player1Id
        const firstPlayerId = savedGame.currentPlayer === 0 ? savedGame.player1Id : (savedGame.player2Id || savedGame.player1Id);
        // Делаем бросок кубиков для первого игрока (skipPlayerCheck = true, так как это автоматический бросок)
        await this.rollDice(gameId, firstPlayerId, true);
        // Перезагружаем игру после броска кубиков
        const gameWithDice = await this.findOne(gameId);
        
        // ВАЖНО: Отправляем обновленное состояние игры через WebSocket после броска кубиков
        const gameStateAfterDice = await this.getGameState(gameId);
        this.gamesGateway.server?.to(`game:${gameId}`).emit('game_state', gameStateAfterDice);
        
        this.logger.log(`✅ Автоматический бросок кубиков выполнен для игры ${gameId}, первый игрок: ${firstPlayerId}`);
        return gameWithDice;
      } catch (error) {
        this.logger.error(`Ошибка при автоматическом броске кубиков для игры ${gameId}:`, error);
        return savedGame;
      }
    }
    
    return savedGame;
  }

  async setupSandboxBoard(
    gameId: string,
    playerId: string,
    setup: { points: number[]; bar?: { white: number; black: number }; bearOff?: { white: number; black: number } },
  ): Promise<Game> {
    const game = await this.findOne(gameId);
    
    if (game.type !== GameType.SANDBOX) {
      throw new BadRequestException('Этот метод доступен только для свободного стола');
    }

    if (game.player1Id !== playerId) {
      throw new BadRequestException('Вы не владелец этого свободного стола');
    }

    // Обновляем состояние доски
    const currentState = game.gameState || {};
    game.gameState = {
      ...currentState,
      points: setup.points || currentState.points,
      bar: setup.bar || currentState.bar || { white: 0, black: 0 },
      bearOff: setup.bearOff || currentState.bearOff || { white: 0, black: 0 },
    };

    const savedGame = await this.gamesRepository.save(game);
    
    // Уведомляем через WebSocket
    this.gamesGateway.server.to(`game:${gameId}`).emit('sandbox_board_updated', {
      gameState: savedGame.gameState,
    });

    return savedGame;
  }

  async getMoves(gameId: string): Promise<GameMove[]> {
    return this.movesRepository.find({
      where: { gameId },
      order: { moveNumber: 'ASC' },
    });
  }

  async setSandboxDice(gameId: string, playerId: string, dice: number[], player?: number): Promise<Game> {
    const game = await this.findOne(gameId);
    
    if (game.type !== GameType.SANDBOX) {
      throw new BadRequestException('Этот метод доступен только для свободного стола');
    }

    if (game.player1Id !== playerId) {
      throw new BadRequestException('Вы не владелец этого свободного стола');
    }

    // Если dice пустой массив, просто переключаем игрока без установки кубиков
    if (dice.length === 0) {
      if (player !== undefined) {
        game.currentPlayer = player;
        // Синхронизируем с gameState для движка
        if (game.gameState) {
          game.gameState.currentPlayer = player;
        }
        const savedGame = await this.gamesRepository.save(game);
        this.gamesGateway.server.to(`game:${gameId}`).emit('sandbox_board_updated', {
          gameState: savedGame.gameState,
          currentPlayer: savedGame.currentPlayer,
        });
        return savedGame;
      }
      throw new BadRequestException('Необходимо указать игрока или кубики');
    }

    if (!Array.isArray(dice) || dice.length !== 2 || dice[0] < 1 || dice[0] > 6 || dice[1] < 1 || dice[1] > 6) {
      throw new BadRequestException('Некорректные значения кубиков');
    }

    const targetPlayer = player !== undefined ? player : game.currentPlayer;
    
    // В sandbox режиме при установке дублей расширяем их до 4 значений
    let finalDice = dice;
    if (dice[0] === dice[1]) {
      finalDice = [dice[0], dice[0], dice[0], dice[0]];
    }

    // Обновляем состояние кубиков
    const currentState = game.gameState || {};
    game.gameState = {
      ...currentState,
      dice: finalDice,
      currentPlayer: targetPlayer, // Синхронизируем для движка
    };

    // Устанавливаем текущего игрока
    game.currentPlayer = targetPlayer;

    const savedGame = await this.gamesRepository.save(game);
    
    // Уведомляем через WebSocket
    this.gamesGateway.server.to(`game:${gameId}`).emit('sandbox_dice_updated', {
      dice: finalDice,
      currentPlayer: savedGame.currentPlayer,
    });

    return savedGame;
  }

  /**
   * Sandbox Chapters management
   */
  async getSandboxChapters(userId: string): Promise<SandboxChapter[]> {
    return this.sandboxChapterRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createSandboxChapter(userId: string, name: string, gameState: any): Promise<SandboxChapter> {
    const chapter = this.sandboxChapterRepository.create({
      userId,
      name,
      gameState,
    });
    return this.sandboxChapterRepository.save(chapter);
  }

  async updateSandboxChapter(chapterId: string, userId: string, update: { name?: string; gameState?: any }): Promise<SandboxChapter> {
    const chapter = await this.sandboxChapterRepository.findOne({ where: { id: chapterId, userId } });
    if (!chapter) {
      throw new BadRequestException('Chapter not found or access denied');
    }
    
    if (update.name) chapter.name = update.name;
    if (update.gameState) chapter.gameState = update.gameState;
    
    return this.sandboxChapterRepository.save(chapter);
  }

  async deleteSandboxChapter(chapterId: string, userId: string): Promise<void> {
    const chapter = await this.sandboxChapterRepository.findOne({ where: { id: chapterId, userId } });
    if (!chapter) {
      throw new BadRequestException('Chapter not found or access denied');
    }
    await this.sandboxChapterRepository.remove(chapter);
  }

  async getGameAnalytics(gameId: string): Promise<any> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['player1', 'player2'],
    });

    if (!game) {
      throw new NotFoundException('Игра не найдена');
    }

    // Загружаем все ходы игры
    const moves = await this.movesRepository.find({
      where: { gameId },
      order: { moveNumber: 'ASC', createdAt: 'ASC' },
      relations: ['player'],
    });

    // Форматируем данные для аналитики
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}.${month}.${day}`;
    };

    const formatTime = (date: Date) => {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}.${minutes}`;
    };

    const formatDateTime = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const variation = game.mode === GameMode.LONG ? 'LongNarde' : 'ShortNarde';
    const eventDate = formatDate(game.createdAt);
    const eventTime = formatTime(game.createdAt);
    const eventBegin = formatDateTime(game.createdAt);
    const eventEnd = game.updatedAt ? formatDateTime(game.updatedAt) : formatDateTime(new Date());

    const player1Name = game.player1?.username || game.player1?.nickname || 'Player 1';
    const player1Id = game.player1?.id || '';
    const player2Name = game.player2?.username || game.player2?.nickname || 'Bot' || 'Player 2';
    const player2Id = game.player2?.id || '';

    // Форматируем ходы - группируем по игрокам и чередуем
    const player1Moves: Array<{ moveNumber: number; dice: string; moves: string }> = [];
    const player2Moves: Array<{ moveNumber: number; dice: string; moves: string }> = [];
    let moveNumber = 1;
    let lastPlayerId: string | null = null;

    for (const move of moves) {
      const dice = Array.isArray(move.dice) ? move.dice : [];
      const moveList = Array.isArray(move.moves) ? move.moves : [];
      
      // Определяем, чей это ход
      const isPlayer1 = move.playerId === game.player1Id;
      
      // Если сменился игрок, увеличиваем номер хода
      if (lastPlayerId !== null && move.playerId !== lastPlayerId) {
        moveNumber++;
      }
      lastPlayerId = move.playerId;

      // Форматируем кубики
      const diceStr = dice.length >= 2 ? `${dice[0]}${dice[1]}` : dice.join('');
      
      // Форматируем ходы в формате "from/to"
      const movesStr = moveList
        .map((m: any) => {
          const from = m.from !== undefined ? m.from : m.fromPoint;
          const to = m.to !== undefined ? m.to : m.toPoint;
          
          if (from === undefined || to === undefined) {
            return '';
          }
          
          // Конвертируем индексы точек в номера точек
          // Для длинных нард: 0-23 -> 24-1 (0 = точка 24, 23 = точка 1)
          // Для коротких нард: 0-23 -> 1-24 (0 = точка 1, 23 = точка 24)
          const fromPoint = game.mode === GameMode.LONG ? (24 - from) : (from + 1);
          const toPoint = game.mode === GameMode.LONG ? (24 - to) : (to + 1);
          return `${fromPoint}/${toPoint}`;
        })
        .filter(Boolean)
        .join(' ');

      if (movesStr) {
        const moveData = { moveNumber, dice: diceStr, moves: movesStr };
        if (isPlayer1) {
          player1Moves.push(moveData);
        } else {
          player2Moves.push(moveData);
        }
      }
    }

    // Объединяем ходы игроков попарно (как в примере)
    const formattedMoves: string[] = [];
    const maxMoves = Math.max(player1Moves.length, player2Moves.length);
    
    for (let i = 0; i < maxMoves; i++) {
      const p1Move = player1Moves[i];
      const p2Move = player2Moves[i];
      
      if (p1Move) {
        formattedMoves.push(`  ${p1Move.moveNumber}) ${p1Move.dice}: ${p1Move.moves}`);
      }
      if (p2Move) {
        formattedMoves.push(`  ${p2Move.moveNumber}) ${p2Move.dice}: ${p2Move.moves}`);
      }
    }

    // Определяем результат
    const result = game.winnerId === game.player1Id 
      ? `0-${game.player2Score || 1}` 
      : game.winnerId === game.player2Id 
        ? `${game.player1Score || 1}-0` 
        : '0-0';

    // Формируем текст аналитики
    const analyticsText = `; [Site "NardGammon"]
; [Variation "${variation}"]
; [Crawford "On"]
; [EventDate "${eventDate}"]
; [EventTime "${eventTime}"]
; [Match ID "${gameId}"]
; [EventBegin "${eventBegin}"]
; [EventEnd "${eventEnd}"]
; [Player 1 "${player1Name} ( ${player1Id} )"]
; [Player 2 "${player2Name} ( ${player2Id} )"]
; [Jacoby "Off"]
; [Beaver "Off"]
; [CubeLimit "1"]
; [Game 1 "ID: ${gameId}. Start offset: white(${game.p1Offset}) black(${game.p2Offset}) "]
; [Result "${result}"]

 0 point match

 Game 1
 ${player1Name} : ${game.player1Score || 0}                      ${player2Name} : ${game.player2Score || 0}
${formattedMoves.join('\n')}
                                  ${game.winnerId === game.player2Id ? 'Wins 2 points and the match' : game.winnerId === game.player1Id ? 'Wins 2 points and the match' : ''}`;

    return {
      text: analyticsText,
      game: {
        id: game.id,
        mode: game.mode,
        type: game.type,
        player1: {
          id: game.player1Id,
          name: player1Name,
          score: game.player1Score || 0,
        },
        player2: {
          id: game.player2Id,
          name: player2Name,
          score: game.player2Score || 0,
        },
        winnerId: game.winnerId,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
        p1Offset: game.p1Offset,
        p2Offset: game.p2Offset,
      },
      moves: moves.map(move => ({
        moveNumber: move.moveNumber,
        playerId: move.playerId,
        dice: move.dice,
        moves: move.moves,
        createdAt: move.createdAt,
      })),
    };
  }

  /**
   * Проверка и обработка таймаутов выбора смещения
   * Турниры: 3 минуты
   * Обычные игры: 30 секунд
   */
  async checkAndProcessOffsetTimeouts(): Promise<void> {
    const now = new Date();
    
    // Находим игры в статусе WAITING, где второй игрок не выбрал смещение
    const waitingGames = await this.gamesRepository.find({
      where: {
        status: GameStatus.WAITING,
      },
    });

    for (const game of waitingGames) {
      try {
        // Пропускаем игры без второго игрока или sandbox
        if (!game.player2Id || game.type === GameType.SANDBOX || game.type === GameType.VS_BOT) {
          continue;
        }

        // Определяем таймаут в зависимости от типа игры
        const timeoutMs = game.type === GameType.TOURNAMENT 
          ? 3 * 60 * 1000  // 3 минуты для турниров
          : 30 * 1000;     // 30 секунд для обычных игр

        // Проверяем, выбрали ли игроки смещение
        const p1OffsetChosen = game.p1OffsetChosenAt !== null;
        const p2OffsetChosen = game.p2OffsetChosenAt !== null;

        // Если оба выбрали - пропускаем (игра должна была перейти в IN_PROGRESS)
        if (p1OffsetChosen && p2OffsetChosen) {
          continue;
        }

        // Определяем время начала отсчета (createdAt игры)
        const startTime = game.createdAt || new Date();
        const elapsed = now.getTime() - startTime.getTime();

        // Проверяем таймаут для player1
        if (!p1OffsetChosen && elapsed >= timeoutMs) {
          this.logger.warn(`Таймаут выбора смещения для player1 в игре ${game.id}`);
          // Засчитываем поражение player1, победитель - player2
          await this.resignGameOnOffsetTimeout(game.id, game.player1Id);
          continue;
        }

        // Проверяем таймаут для player2
        if (!p2OffsetChosen && elapsed >= timeoutMs) {
          this.logger.warn(`Таймаут выбора смещения для player2 в игре ${game.id}`);
          // Засчитываем поражение player2, победитель - player1
          await this.resignGameOnOffsetTimeout(game.id, game.player2Id);
          continue;
        }
      } catch (error) {
        this.logger.error(`Ошибка при обработке таймаута смещения для игры ${game.id}: ${error.message}`);
      }
    }
  }

  /**
   * Засчитывает поражение игроку при таймауте выбора смещения
   */
  private async resignGameOnOffsetTimeout(gameId: string, timeoutPlayerId: string): Promise<void> {
    const game = await this.findOne(gameId);
    
    // Проверяем, что игра еще в статусе WAITING
    if (game.status !== GameStatus.WAITING) {
      return;
    }

    // Определяем победителя (противник игрока, не выбравшего смещение)
    const winnerId = game.player1Id === timeoutPlayerId ? game.player2Id : game.player1Id;
    
    if (!winnerId) {
      this.logger.error(`Не удалось определить победителя для игры ${gameId}`);
      return;
    }

    // Завершаем игру через resignGame (автоматически засчитает поражение)
    await this.resignGame(gameId, timeoutPlayerId);
  }
}
