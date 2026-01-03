import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { Tournament, TournamentFormat, TournamentStatus } from './tournament.entity';
import { TournamentMatch, MatchStatus } from './tournament-match.entity';
import { GamesService } from '../games/games.service';
import { GameMode, GameType } from '../games/game.entity';
import { UsersService } from '../users/users.service';
import { QuestsService } from '../quests/quests.service';
import { QuestTarget } from '../quests/quest.entity';
import { ProgressService } from '../progress/progress.service';
import { TournamentTicketsService } from './tournament-tickets.service';

@Injectable()
export class TournamentsService {
  private readonly logger = new Logger(TournamentsService.name);

  constructor(
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
    @InjectRepository(TournamentMatch)
    private matchesRepository: Repository<TournamentMatch>,
    @Inject(forwardRef(() => GamesService))
    private gamesService: GamesService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    @Inject(forwardRef(() => QuestsService))
    private questsService: QuestsService,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
    private ticketsService: TournamentTicketsService,
  ) {}

  async create(tournamentData: Partial<Tournament>): Promise<Tournament> {
    try {
      // Валидация обязательных полей
      if (!tournamentData.name) {
        throw new BadRequestException('Название турнира обязательно');
      }
      if (!tournamentData.maxParticipants || tournamentData.maxParticipants < 2) {
        throw new BadRequestException('Максимальное количество участников должно быть не менее 2');
      }
      if (!tournamentData.registrationStart || !tournamentData.registrationEnd || !tournamentData.startDate) {
        throw new BadRequestException('Даты регистрации и начала турнира обязательны');
      }

      const tournament = this.tournamentsRepository.create({
        ...tournamentData,
        currentParticipants: 0,
        status: tournamentData.status || TournamentStatus.UPCOMING,
        format: tournamentData.format || TournamentFormat.BRACKET,
        mode: tournamentData.mode || GameMode.SHORT,
      });
      return await this.tournamentsRepository.save(tournament);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при создании турнира: ${error.message}`);
    }
  }

  async findAll(status?: string, userId?: string): Promise<any[]> {
    let where: any = {};
    
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      if (statuses.length === 1) {
        where.status = statuses[0] as TournamentStatus;
      } else {
        // Используем In() для фильтрации по нескольким статусам
        where.status = In(statuses as TournamentStatus[]);
      }
    }
    
    const tournaments = await this.tournamentsRepository.find({
      where,
      order: { startDate: 'ASC' },
      relations: ['matches'],
    });

    // Проверяем регистрацию пользователя и вычисляем призовой фонд
    const result = [];
    for (const tournament of tournaments) {
      let registered = false;
      // Пересчитываем currentParticipants для каждого турнира
      const actualParticipants = await this.matchesRepository.count({
        where: { 
          tournamentId: tournament.id,
          player1Id: Not(IsNull()),
        },
      });
      if (tournament.currentParticipants !== actualParticipants) {
        tournament.currentParticipants = actualParticipants;
        await this.tournamentsRepository.save(tournament);
      }

      if (userId) {
        // Проверяем регистрацию - пользователь зарегистрирован, если он player1 в матче
        const userMatch = await this.matchesRepository.findOne({
          where: { 
            tournamentId: tournament.id, 
            player1Id: userId,
          },
        });
        registered = !!userMatch;
      }

      // Вычисляем призовой фонд: Сумма всех призов типа 'nar'
      const entryFee = Number(tournament.entryFee || 0);
      let prizePool = 0;
      
      if (tournament.prizes) {
        let prizes = tournament.prizes;
        // Нормализация призов (если это объект или массив)
        if (!Array.isArray(prizes) && typeof prizes === 'object') {
           prizes = Object.values(prizes);
        }
        
        if (Array.isArray(prizes)) {
           prizePool = prizes.reduce((acc, prize) => {
             // Суммируем только призы в NAR, либо если тип не указан но есть amount (старый формат)
             if ((prize.type === 'nar' || !prize.type) && prize.amount) {
               return acc + Number(prize.amount);
             }
             return acc;
           }, 0);
        }
      }
      
      // Если призов нет, используем старую логику или 0 (но пользователь просил фиксированный пул)
      if (prizePool === 0 && (!tournament.prizes || (Array.isArray(tournament.prizes) && tournament.prizes.length === 0))) {
         // Fallback? Нет, пользователь сказал "формируется админами". Значит если 0, то 0.
         // Но для обратной совместимости можно оставить entryFee * participants, если prizes вообще нет?
         // Пользователь был категоричен: "не кол-вом взносов".
         prizePool = 0;
      }

      // Вычисляем текущий раунд и общее количество раундов (для bracket формата)
      let currentRound = 0;
      let totalRounds = 0;
      if (tournament.format === TournamentFormat.BRACKET && tournament.matches) {
        const rounds = new Set(tournament.matches.map(m => m.round));
        totalRounds = Math.ceil(Math.log2(tournament.maxParticipants));
        currentRound = Math.max(...Array.from(rounds), 0) + 1;
      }

      result.push({
        id: tournament.id,
        name: tournament.name,
        description: tournament.description,
        mode: tournament.mode,
        format: tournament.format,
        status: tournament.status,
        maxParticipants: tournament.maxParticipants,
        currentParticipants: tournament.currentParticipants,
        entryFee: entryFee,
        prizePool: prizePool,
        prizes: tournament.prizes || null,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        registrationStart: tournament.registrationStart,
        registrationEnd: tournament.registrationEnd,
        registered: registered,
        currentRound: currentRound > 0 ? currentRound : undefined,
        totalRounds: totalRounds > 0 ? totalRounds : undefined,
      });
    }

    return result;
  }

  async findOne(id: string, userId?: string): Promise<any> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id },
      relations: ['matches', 'matches.player1', 'matches.player2'],
    });
    
    if (!tournament) {
      throw new NotFoundException('Турнир не найден');
    }
    
    // Если есть победитель, загружаем его данные
    let winner = null;
    if (tournament.winnerId) {
      winner = await this.usersService.findOne(tournament.winnerId);
    }

    let registered = false;
    if (userId && tournament.matches) {
      // Проверяем регистрацию - пользователь зарегистрирован, если он player1 в матче
      // Ищем в загруженных матчах, чтобы не делать лишний запрос
      const userMatch = tournament.matches.find(m => m.player1?.id === userId || m.player1Id === userId);
      registered = !!userMatch;
    }

    // Вычисляем доп. поля, аналогично findAll
    const entryFee = Number(tournament.entryFee || 0);
    
    // Вычисляем призовой фонд: Сумма всех призов типа 'nar'
    let prizePool = 0;
    if (tournament.prizes) {
      let prizes = tournament.prizes;
      if (!Array.isArray(prizes) && typeof prizes === 'object') {
         prizes = Object.values(prizes);
      }
      
      if (Array.isArray(prizes)) {
         prizePool = prizes.reduce((acc, prize) => {
           if ((prize.type === 'nar' || !prize.type) && prize.amount) {
             return acc + Number(prize.amount);
           }
           return acc;
         }, 0);
      }
    }

    let currentRound = 0;
    let totalRounds = 0;
    if (tournament.format === TournamentFormat.BRACKET && tournament.matches && tournament.matches.length > 0) {
      const rounds = new Set(tournament.matches.map(m => m.round));
      totalRounds = Math.ceil(Math.log2(tournament.maxParticipants));
      currentRound = Math.max(...Array.from(rounds), 0) + 1;
    }

    return {
      ...tournament,
      registered,
      winner: winner ? {
        id: winner.id,
        username: winner.username,
        nickname: winner.nickname,
        avatarUrl: winner.avatarUrl,
      } : null,
      prizePool,
      currentRound: currentRound > 0 ? currentRound : undefined,
      totalRounds: totalRounds > 0 ? totalRounds : undefined,
    };
  }

  async findReadyToStart(): Promise<Tournament[]> {
    const now = new Date();
    return this.tournamentsRepository
      .createQueryBuilder('tournament')
      .where('tournament.status = :status', { status: TournamentStatus.REGISTRATION })
      .andWhere('tournament.startDate <= :now', { now })
      .orderBy('tournament.startDate', 'ASC')
      .getMany();
  }

  async findTournamentsStartingAt(targetDate: Date): Promise<Tournament[]> {
    const tolerance = 60 * 1000; // 1 минута погрешности
    const minDate = new Date(targetDate.getTime() - tolerance);
    const maxDate = new Date(targetDate.getTime() + tolerance);
    
    return this.tournamentsRepository
      .createQueryBuilder('tournament')
      .where('tournament.status = :status', { status: TournamentStatus.REGISTRATION })
      .andWhere('tournament.startDate >= :minDate', { minDate })
      .andWhere('tournament.startDate <= :maxDate', { maxDate })
      .orderBy('tournament.startDate', 'ASC')
      .getMany();
  }

  async getRegisteredPlayers(tournamentId: string): Promise<string[]> {
    const matches = await this.matchesRepository.find({
      where: {
        tournamentId,
        player1Id: Not(IsNull()),
      },
    });
    return matches.map(m => m.player1Id).filter(id => id !== null) as string[];
  }

  async getUserById(userId: string): Promise<any> {
    return this.usersService.findOne(userId);
  }

  /**
   * Получить таблицу результатов турнира
   */
  async getTournamentResults(tournamentId: string): Promise<any> {
    const tournament = await this.findOne(tournamentId);
    
    if (tournament.format === TournamentFormat.BRACKET) {
      return this.getBracketResults(tournament);
    } else {
      return this.getRoundRobinResults(tournament);
    }
  }

  /**
   * Результаты брекет-турнира
   */
  private async getBracketResults(tournament: Tournament): Promise<any> {
    const matches = await this.matchesRepository.find({
      where: { tournamentId: tournament.id },
      relations: ['player1', 'player2'],
      order: { round: 'ASC', matchNumber: 'ASC' },
    });

    // Группируем матчи по раундам
    const rounds: any[] = [];
    const roundsMap = new Map<number, any[]>();

    matches.forEach(match => {
      if (!roundsMap.has(match.round)) {
        roundsMap.set(match.round, []);
      }
      roundsMap.get(match.round)!.push({
        id: match.id,
        round: match.round,
        matchNumber: match.matchNumber,
        player1: match.player1 ? {
          id: match.player1.id,
          username: match.player1.username,
        } : null,
        player2: match.player2 ? {
          id: match.player2.id,
          username: match.player2.username,
        } : null,
        winnerId: match.winnerId,
        status: match.status,
        scheduledAt: match.scheduledAt,
        gameId: match.gameId,
      });
    });

    // Преобразуем в массив раундов
    roundsMap.forEach((matches, round) => {
      rounds.push({
        round,
        matches: matches.sort((a, b) => a.matchNumber - b.matchNumber),
      });
    });

    return {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      format: tournament.format,
      rounds: rounds.sort((a, b) => a.round - b.round),
    };
  }

  /**
   * Результаты кругового турнира (таблица с очками)
   */
  private async getRoundRobinResults(tournament: Tournament): Promise<any> {
    const matches = await this.matchesRepository.find({
      where: { tournamentId: tournament.id },
      relations: ['player1', 'player2'],
    });

    // Подсчитываем очки для каждого участника
    const standings = new Map<string, {
      userId: string;
      username: string;
      wins: number;
      losses: number;
      draws: number;
      points: number;
    }>();

    matches.forEach(match => {
      if (!match.player1Id || !match.player2Id) return;

      // Инициализируем участников если их еще нет
      if (!standings.has(match.player1Id)) {
        standings.set(match.player1Id, {
          userId: match.player1Id,
          username: match.player1?.username || 'Unknown',
          wins: 0,
          losses: 0,
          draws: 0,
          points: 0,
        });
      }
      if (!standings.has(match.player2Id)) {
        standings.set(match.player2Id, {
          userId: match.player2Id,
          username: match.player2?.username || 'Unknown',
          wins: 0,
          losses: 0,
          draws: 0,
          points: 0,
        });
      }

      const player1 = standings.get(match.player1Id)!;
      const player2 = standings.get(match.player2Id)!;

      if (match.status === MatchStatus.FINISHED && match.winnerId) {
        if (match.winnerId === match.player1Id) {
          player1.wins++;
          player1.points += 2; // Победа = 2 очка
          player2.losses++;
        } else {
          player2.wins++;
          player2.points += 2;
          player1.losses++;
        }
      }
    });

    // Сортируем по очкам (убывание)
    const standingsArray = Array.from(standings.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.wins - a.wins; // При равных очках по победам
    });

    return {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      format: tournament.format,
      standings: standingsArray.map((s, index) => ({
        ...s,
        rank: index + 1,
      })),
    };
  }

  async register(tournamentId: string, userId: string): Promise<void> {
    // Получаем чистую сущность Tournament без доп. полей, чтобы избежать ошибок при сохранении
    const tournament = await this.tournamentsRepository.findOne({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException('Турнир не найден');
    }
    
    if (tournament.status !== TournamentStatus.REGISTRATION) {
      throw new BadRequestException('Регистрация закрыта');
    }

    if (new Date() > tournament.registrationEnd) {
      throw new BadRequestException('Время регистрации истекло');
    }

    // Пересчитываем текущее количество участников на основе реальных матчей
    const actualParticipants = await this.matchesRepository.count({
      where: { 
        tournamentId,
        player1Id: Not(IsNull()), // Только матчи с зарегистрированным первым игроком
      },
    });

    // Синхронизируем currentParticipants с реальным количеством
    if (tournament.currentParticipants !== actualParticipants) {
      tournament.currentParticipants = actualParticipants;
      await this.tournamentsRepository.save(tournament);
    }

    if (tournament.currentParticipants >= tournament.maxParticipants) {
      throw new BadRequestException('Турнир заполнен');
    }

    // Проверяем регистрацию через matches (player1Id или player2Id)
    // Проверяем только матчи, где пользователь является player1 (зарегистрированным участником)
    const existingMatch = await this.matchesRepository.findOne({
      where: { 
        tournamentId, 
        player1Id: userId,
      },
    });

    if (existingMatch) {
      throw new BadRequestException('Вы уже зарегистрированы');
    }

    // Проверяем взнос или билет
    if (tournament.entryFee > 0) {
      // Сначала проверяем, есть ли билет
      const hasTicket = await this.ticketsService.useTicket(userId, tournamentId);
      
      if (!hasTicket) {
        // Если билета нет, списываем NAR-coin
        const user = await this.usersService.findOne(userId);
        const userBalance = Number(user.narCoin || 0);
        const entryFee = Number(tournament.entryFee);
        
        if (userBalance < entryFee) {
          throw new BadRequestException(
            `Недостаточно средств. Требуется: ${entryFee} NAR-coin или билет на турнир. Доступно: ${userBalance} NAR-coin`
          );
        }
        
        await this.usersService.update(userId, { narCoin: userBalance - entryFee });
      } else {
        // Билет использован успешно
        this.logger.log(`🎫 Пользователь ${userId} использовал билет для участия в турнире ${tournamentId}`);
      }
    }

    // Создаем запись в matches для регистрации (пока без второго игрока)
    await this.matchesRepository.save({
      tournamentId,
      player1Id: userId,
      player2Id: null,
      round: 0,
      matchNumber: tournament.currentParticipants,
      status: MatchStatus.SCHEDULED,
    });

    tournament.currentParticipants++;
    await this.tournamentsRepository.save(tournament);
    
    // Обновляем квесты на участие в турнире
    try {
      await this.questsService.updateProgress(userId, QuestTarget.TOURNAMENT, 1);
    } catch (error) {
      // Логируем ошибку, но не прерываем процесс
      console.error('Ошибка при обновлении квестов tournament:', error);
    }
  }

  async startTournament(tournamentId: string): Promise<void> {
    const tournament = await this.findOne(tournamentId);
    
    if (tournament.status !== TournamentStatus.REGISTRATION) {
      throw new BadRequestException('Турнир не может быть запущен');
    }

    tournament.status = TournamentStatus.IN_PROGRESS;
    await this.tournamentsRepository.save(tournament);

    if (tournament.format === TournamentFormat.BRACKET) {
      await this.createBracketMatches(tournament);
    } else {
      await this.createRoundRobinMatches(tournament);
    }
  }

  private async createBracketMatches(tournament: Tournament): Promise<void> {
    // Получаем всех зарегистрированных участников (player1Id из матчей round 0)
    const registeredMatches = await this.matchesRepository.find({
      where: {
        tournamentId: tournament.id,
        round: 0,
        player1Id: Not(IsNull()),
      },
      order: { matchNumber: 'ASC' },
    });

    const participants = registeredMatches.map(m => m.player1Id).filter(id => id !== null);
    const rounds = Math.ceil(Math.log2(participants.length));

    // Удаляем старые матчи round 0 (они были созданы при регистрации)
    // Создаем новые матчи первого раунда с парами участников
    const matchesInFirstRound = Math.floor(participants.length / 2);
    
    for (let matchNum = 0; matchNum < matchesInFirstRound; matchNum++) {
      const player1Id = participants[matchNum * 2];
      const player2Id = participants[matchNum * 2 + 1];
      
      // Обновляем существующий матч или создаем новый
      const existingMatch = registeredMatches.find(m => m.matchNumber === matchNum);
      if (existingMatch) {
        existingMatch.player1Id = player1Id;
        existingMatch.player2Id = player2Id;
        existingMatch.status = MatchStatus.SCHEDULED;
        existingMatch.scheduledAt = tournament.startDate; // Устанавливаем время начала матча
        await this.matchesRepository.save(existingMatch);
      } else {
        await this.matchesRepository.save({
          tournamentId: tournament.id,
          round: 0,
          matchNumber: matchNum,
          player1Id,
          player2Id,
          status: MatchStatus.SCHEDULED,
          scheduledAt: tournament.startDate, // Устанавливаем время начала матча
        });
      }
    }

    // Если нечетное количество участников, последний проходит автоматически (BYE)
    if (participants.length % 2 === 1) {
      const byePlayerId = participants[participants.length - 1];
      await this.matchesRepository.save({
        tournamentId: tournament.id,
        round: 0,
        matchNumber: matchesInFirstRound,
        player1Id: byePlayerId,
        player2Id: null,
        status: MatchStatus.BYE,
        winnerId: byePlayerId, // Автоматический проход
      });
    }

    // Создаем пустые матчи для следующих раундов (будут заполнены победителями)
    for (let round = 1; round < rounds; round++) {
      const matchesInRound = Math.floor(participants.length / Math.pow(2, round + 1));
      for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
        await this.matchesRepository.save({
          tournamentId: tournament.id,
          round,
          matchNumber: matchNum,
          player1Id: null, // Будет заполнено победителем предыдущего раунда
          player2Id: null,
          status: MatchStatus.SCHEDULED,
        });
      }
    }
  }

  private async createRoundRobinMatches(tournament: Tournament): Promise<void> {
    const participants = tournament.currentParticipants;
    let matchNum = 0;
    
    for (let i = 0; i < participants; i++) {
      for (let j = i + 1; j < participants; j++) {
        await this.matchesRepository.save({
          tournamentId: tournament.id,
          round: 0,
          matchNumber: matchNum++,
          status: MatchStatus.SCHEDULED,
        });
      }
    }
  }

  async createMatch(
    tournamentId: string,
    player1Id: string,
    player2Id: string,
    round: number,
    matchNumber: number,
  ): Promise<TournamentMatch> {
    const tournament = await this.findOne(tournamentId);
    const game = await this.gamesService.create(player1Id, player2Id, tournament.mode, GameType.TOURNAMENT);

    const match = this.matchesRepository.create({
      tournamentId,
      player1Id,
      player2Id,
      gameId: game.id,
      round,
      matchNumber,
      status: MatchStatus.IN_PROGRESS,
    });

    return this.matchesRepository.save(match);
  }

  /**
   * Найти турнирный матч по gameId
   */
  async findMatchByGameId(gameId: string): Promise<TournamentMatch | null> {
    return this.matchesRepository.findOne({
      where: { gameId },
    });
  }

  async finishMatch(matchId: string, winnerId: string): Promise<void> {
    const match = await this.matchesRepository.findOne({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException('Матч не найден');
    }

    match.winnerId = winnerId;
    match.status = MatchStatus.FINISHED;
    await this.matchesRepository.save(match);

    // Начисляем XP за победу в турнире
    // Базовый XP за победу в турнире выше, чем в обычной игре
    // Формула: базовый XP * (1 + множитель за раунд)
    const tournament = await this.findOne(match.tournamentId);
    const baseTournamentXP = 200; // Базовый XP за победу в турнире
    const roundMultiplier = match.round + 1; // Чем дальше раунд, тем больше XP
    const winnerXP = baseTournamentXP * roundMultiplier;
    
    // Проигравший получает меньше XP
    const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;
    const loserXP = Math.floor(baseTournamentXP * 0.5 * roundMultiplier);
    
    try {
      if (this.progressService) {
        await this.progressService.addXP(winnerId, winnerXP);
        if (loserId) {
          await this.progressService.addXP(loserId, loserXP);
        }
      }
    } catch (error) {
      console.error('Ошибка при начислении XP за турнир:', error);
    }

    await this.advanceTournament(match.tournamentId);
  }

  private async advanceTournament(tournamentId: string): Promise<void> {
    // Загружаем турнир через репозиторий, а не через findOne (который возвращает DTO)
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });
    
    if (!tournament) {
      this.logger.error(`Турнир ${tournamentId} не найден при попытке продвижения`);
      return;
    }
    
    if (tournament.format === TournamentFormat.BRACKET) {
      await this.advanceBracketTournament(tournament);
    } else {
      await this.advanceRoundRobinTournament(tournament);
    }
  }

  /**
   * Продвижение брекет-турнира: создание матчей следующего раунда с победителями
   */
  private async advanceBracketTournament(tournament: Tournament): Promise<void> {
    // Получаем все завершенные матчи текущего раунда
    const finishedMatches = await this.matchesRepository.find({
      where: {
        tournamentId: tournament.id,
        status: MatchStatus.FINISHED,
      },
      order: { round: 'ASC', matchNumber: 'ASC' },
    });

    if (finishedMatches.length === 0) {
      return; // Нет завершенных матчей
    }

    // Находим максимальный раунд с завершенными матчами
    const maxFinishedRound = Math.max(...finishedMatches.map(m => m.round));
    
    // Получаем все матчи текущего раунда
    const currentRoundMatches = await this.matchesRepository.find({
      where: {
        tournamentId: tournament.id,
        round: maxFinishedRound,
      },
    });

    // Проверяем, все ли матчи текущего раунда завершены
    const allFinished = currentRoundMatches.every(m => 
      m.status === MatchStatus.FINISHED || m.status === MatchStatus.BYE
    );

    if (!allFinished) {
      return; // Еще есть незавершенные матчи в текущем раунде
    }

    // Если это финальный раунд, завершаем турнир и распределяем награды
    const totalRounds = Math.ceil(Math.log2(tournament.currentParticipants));
    const finalRoundNumber = totalRounds - 1;
    
    this.logger.log(`Проверка финального раунда: maxFinishedRound=${maxFinishedRound}, totalRounds=${totalRounds}, finalRoundNumber=${finalRoundNumber}, currentParticipants=${tournament.currentParticipants}`);
    
    if (maxFinishedRound >= finalRoundNumber) {
      // Определяем победителя турнира (победитель финального матча)
      const finalMatch = currentRoundMatches.find(m => m.round === maxFinishedRound);
      if (finalMatch && finalMatch.winnerId) {
        this.logger.log(`Завершение турнира ${tournament.id}: победитель ${finalMatch.winnerId}`);
        tournament.status = TournamentStatus.FINISHED;
        tournament.winnerId = finalMatch.winnerId;
        tournament.endDate = new Date();
        await this.tournamentsRepository.save(tournament);
        
        // Распределяем награды (перезагружаем турнир с актуальными данными)
        const savedTournament = await this.tournamentsRepository.findOne({
          where: { id: tournament.id },
        });
        if (savedTournament) {
          await this.distributePrizes(savedTournament);
        }
      } else {
        this.logger.warn(`Финальный матч не найден или нет победителя для турнира ${tournament.id}`);
      }
      return;
    }

    // Создаем матчи следующего раунда с победителями
    const nextRound = maxFinishedRound + 1;
    // Фильтруем только матчи с победителями (пропускаем матчи, где оба игрока пропустили)
    const winners = currentRoundMatches
      .filter(m => m.winnerId) // Только матчи с победителем (игнорируем матчи, где оба пропустили)
      .map(m => m.winnerId)
      .sort((a, b) => {
        // Сортируем по matchNumber для правильного распределения
        const matchA = currentRoundMatches.find(m => m.winnerId === a);
        const matchB = currentRoundMatches.find(m => m.winnerId === b);
        return (matchA?.matchNumber || 0) - (matchB?.matchNumber || 0);
      });

    const matchesInNextRound = Math.floor(winners.length / 2);
    
    for (let matchNum = 0; matchNum < matchesInNextRound; matchNum++) {
      const player1Id = winners[matchNum * 2];
      const player2Id = winners[matchNum * 2 + 1];
      
      // Ищем существующий матч следующего раунда или создаем новый
      let nextMatch = await this.matchesRepository.findOne({
        where: {
          tournamentId: tournament.id,
          round: nextRound,
          matchNumber: matchNum,
        },
      });

      if (nextMatch) {
        nextMatch.player1Id = player1Id;
        nextMatch.player2Id = player2Id;
        nextMatch.status = MatchStatus.SCHEDULED;
        nextMatch.scheduledAt = new Date(); // Матч следующего раунда начинается сразу после завершения предыдущего
        await this.matchesRepository.save(nextMatch);
      } else {
        await this.matchesRepository.save({
          tournamentId: tournament.id,
          round: nextRound,
          matchNumber: matchNum,
          player1Id,
          player2Id,
          status: MatchStatus.SCHEDULED,
          scheduledAt: new Date(), // Матч следующего раунда начинается сразу после завершения предыдущего
        });
      }
    }

    // Если нечетное количество победителей, последний проходит автоматически
    if (winners.length % 2 === 1) {
      const byePlayerId = winners[winners.length - 1];
      let byeMatch = await this.matchesRepository.findOne({
        where: {
          tournamentId: tournament.id,
          round: nextRound,
          matchNumber: matchesInNextRound,
        },
      });

      if (byeMatch) {
        byeMatch.player1Id = byePlayerId;
        byeMatch.player2Id = null;
        byeMatch.status = MatchStatus.BYE;
        byeMatch.winnerId = byePlayerId;
        await this.matchesRepository.save(byeMatch);
      } else {
        await this.matchesRepository.save({
          tournamentId: tournament.id,
          round: nextRound,
          matchNumber: matchesInNextRound,
          player1Id: byePlayerId,
          player2Id: null,
          status: MatchStatus.BYE,
          winnerId: byePlayerId,
        });
      }
    }
  }

  /**
   * Продвижение кругового турнира (ROUND_ROBIN)
   */
  private async advanceRoundRobinTournament(tournament: Tournament): Promise<void> {
    // Для кругового турнира проверяем завершение всех матчей
    const unfinishedMatches = await this.matchesRepository.find({
      where: {
        tournamentId: tournament.id,
        status: In([MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS]),
      },
    });

    if (unfinishedMatches.length === 0) {
      tournament.status = TournamentStatus.FINISHED;
      tournament.endDate = new Date();
      await this.tournamentsRepository.save(tournament);
    }
  }

  /**
   * Проверка и обработка таймаутов матчей (автоматическое поражение при неявке)
   */
  async checkAndProcessMatchTimeouts(): Promise<void> {
    const now = new Date();
    const threeMinutesInMs = 3 * 60 * 1000;
    
    // Находим матчи, которые должны были начаться более 3 минут назад, но еще не начаты
    const timeoutMatches = await this.matchesRepository
      .createQueryBuilder('match')
      .where('match.status = :status', { status: MatchStatus.SCHEDULED })
      .andWhere('match.scheduledAt IS NOT NULL')
      .andWhere('match.scheduledAt <= :timeoutDate', { 
        timeoutDate: new Date(now.getTime() - threeMinutesInMs) 
      })
      .andWhere('match.player1Id IS NOT NULL')
      .andWhere('match.player2Id IS NOT NULL')
      .andWhere('match.gameId IS NULL')
      .getMany();

    for (const match of timeoutMatches) {
      try {
        // Оба игрока пропустили - оба вылетают (матч завершается без победителя)
        this.logger.warn(`Матч ${match.id} пропущен обоими игроками, оба вылетают`);
        
        // Устанавливаем статус как FINISHED без winnerId (оба проиграли)
        match.status = MatchStatus.FINISHED;
        await this.matchesRepository.save(match);
        
        // Продвигаем турнир (обработает случай, когда оба игрока пропустили)
        await this.advanceTournament(match.tournamentId);
      } catch (error) {
        this.logger.error(`Ошибка при обработке таймаута матча ${match.id}: ${error.message}`);
      }
    }
  }

  /**
   * Старт матча по нажатию игрока
   */
  async startMatch(matchId: string, userId: string): Promise<{ gameId: string }> {
    const match = await this.matchesRepository.findOne({
      where: { id: matchId },
      relations: ['tournament'],
    });

    if (!match) {
      throw new NotFoundException('Матч не найден');
    }

    // Проверяем, что пользователь является участником матча
    if (match.player1Id !== userId && match.player2Id !== userId) {
      throw new BadRequestException('Вы не являетесь участником этого матча');
    }

    // Проверяем статус матча
    if (match.status !== MatchStatus.SCHEDULED) {
      throw new BadRequestException('Матч уже начат или завершен');
    }

    // Проверяем, что матч еще не создан
    if (match.gameId) {
      return { gameId: match.gameId };
    }

    // Проверяем, что оба игрока назначены
    if (!match.player1Id || !match.player2Id) {
      throw new BadRequestException('Оба игрока должны быть назначены для старта матча');
    }

    // Проверяем окно входа (3 минуты после scheduledAt)
    if (match.scheduledAt) {
      const now = new Date();
      const entryWindowEnd = new Date(match.scheduledAt.getTime() + 3 * 60 * 1000);
      
      if (now > entryWindowEnd) {
        // Время окна входа истекло, определяем победителя (тот, кто нажал)
        match.winnerId = userId;
        match.status = MatchStatus.FINISHED;
        await this.matchesRepository.save(match);
        
        await this.advanceTournament(match.tournamentId);
        throw new BadRequestException('Время входа в матч истекло');
      }
    }

    // Создаем игру
    const game = await this.gamesService.create(
      match.player1Id,
      match.player2Id,
      match.tournament.mode,
      GameType.TOURNAMENT,
    );

    // Обновляем матч
    match.gameId = game.id;
    match.status = MatchStatus.IN_PROGRESS;
    await this.matchesRepository.save(match);

    return { gameId: game.id };
  }

  /**
   * Распределение наград по местам при завершении турнира
   */
  private async distributePrizes(tournament: Tournament): Promise<void> {
    if (!tournament.prizes) {
      return; // Нет наград для распределения
    }

    // Нормализуем награды в массив
    let prizes = tournament.prizes;
    if (!Array.isArray(prizes) && typeof prizes === 'object') {
      prizes = Object.values(prizes);
    }

    if (!Array.isArray(prizes) || prizes.length === 0) {
      return; // Нет наград
    }

    // Получаем места участников
    const places = await this.getTournamentPlaces(tournament);
    
    // Группируем награды по местам
    const prizesByPlace: { [place: number]: any[] } = {};
    for (const prize of prizes) {
      const place = prize.place || prize.Place;
      if (place && places[place]) {
        if (!prizesByPlace[place]) {
          prizesByPlace[place] = [];
        }
        prizesByPlace[place].push(prize);
      }
    }

    // Распределяем награды
    for (const [place, prizeList] of Object.entries(prizesByPlace)) {
      const playerId = places[parseInt(place)];
      if (!playerId) {
        continue;
      }

      for (const prize of prizeList) {
        const type = prize.type || prize.Type || 'nar';
        const amount = Number(prize.amount || prize.Amount || prize.quantity || prize.Quantity || 0);
        
        if (amount <= 0) {
          continue;
        }

        try {
          if (type === 'nar' || type === 'NAR Coin' || !type) {
            // Начисляем NAR-coin
            const user = await this.usersService.findOne(playerId);
            if (user) {
              const currentBalance = Number(user.narCoin || 0);
              await this.usersService.update(playerId, {
                narCoin: currentBalance + amount,
              });
              this.logger.log(`💰 Начислено ${amount} NAR-coin игроку ${playerId} за ${place} место в турнире ${tournament.id}`);
            }
          } else if (type === 'xp' || type === 'XP') {
            // Начисляем XP
            if (this.progressService) {
              await this.progressService.addXP(playerId, amount);
              this.logger.log(`⭐ Начислено ${amount} XP игроку ${playerId} за ${place} место в турнире ${tournament.id}`);
            }
          }
        } catch (error) {
          this.logger.error(`Ошибка при начислении награды игроку ${playerId}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Определяет места участников в турнире
   * Для bracket-турнира:
   * - 1 место: победитель финала
   * - 2 место: проигравший в финале
   */
  private async getTournamentPlaces(tournament: Tournament): Promise<{ [place: number]: string }> {
    const places: { [place: number]: string } = {};

    if (tournament.format === TournamentFormat.BRACKET) {
      // Получаем финальный матч
      const totalRounds = Math.ceil(Math.log2(tournament.currentParticipants));
      const finalRound = totalRounds - 1;

      const finalMatches = await this.matchesRepository.find({
        where: {
          tournamentId: tournament.id,
          round: finalRound,
        },
      });

      const finalMatch = finalMatches[0];
      if (finalMatch) {
        if (finalMatch.winnerId) {
          places[1] = finalMatch.winnerId;
        }
        // Проигравший в финале - это игрок, который не является победителем
        if (finalMatch.player1Id && finalMatch.player1Id !== finalMatch.winnerId) {
          places[2] = finalMatch.player1Id;
        } else if (finalMatch.player2Id && finalMatch.player2Id !== finalMatch.winnerId) {
          places[2] = finalMatch.player2Id;
        }
      }
    }

    return places;
  }
}

