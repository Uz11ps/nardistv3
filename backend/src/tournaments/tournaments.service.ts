import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament, TournamentFormat, TournamentStatus } from './tournament.entity';
import { TournamentMatch, MatchStatus } from './tournament-match.entity';
import { GamesService } from '../games/games.service';
import { GameMode, GameType } from '../games/game.entity';

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
    @InjectRepository(TournamentMatch)
    private matchesRepository: Repository<TournamentMatch>,
    private gamesService: GamesService,
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
        where.status = statuses as TournamentStatus[];
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
      if (userId) {
        // Проверяем регистрацию через отдельный запрос к matches
        const userMatch = await this.matchesRepository.findOne({
          where: [
            { tournamentId: tournament.id, player1Id: userId },
            { tournamentId: tournament.id, player2Id: userId },
          ],
        });
        registered = !!userMatch;
      }

      // Вычисляем призовой фонд: взнос * количество участников
      const entryFee = Number(tournament.entryFee || 0);
      const prizePool = entryFee * tournament.currentParticipants;

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

  async findOne(id: string): Promise<Tournament> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id },
      relations: ['matches', 'matches.player1', 'matches.player2'],
    });
    if (!tournament) {
      throw new NotFoundException('Турнир не найден');
    }
    return tournament;
  }

  async register(tournamentId: string, userId: string): Promise<void> {
    const tournament = await this.findOne(tournamentId);
    
    if (tournament.status !== TournamentStatus.REGISTRATION) {
      throw new BadRequestException('Регистрация закрыта');
    }

    if (tournament.currentParticipants >= tournament.maxParticipants) {
      throw new BadRequestException('Турнир заполнен');
    }

    // Проверяем регистрацию через matches (player1Id или player2Id)
    const existingMatch = await this.matchesRepository.findOne({
      where: [
        { tournamentId, player1Id: userId },
        { tournamentId, player2Id: userId },
      ],
    });

    if (existingMatch) {
      throw new BadRequestException('Вы уже зарегистрированы');
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
    const participants = tournament.currentParticipants;
    const rounds = Math.ceil(Math.log2(participants));
    
    for (let round = 0; round < rounds; round++) {
      const matchesInRound = Math.floor(participants / Math.pow(2, round + 1));
      for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
        await this.matchesRepository.save({
          tournamentId: tournament.id,
          round,
          matchNumber: matchNum,
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

  async finishMatch(matchId: string, winnerId: string): Promise<void> {
    const match = await this.matchesRepository.findOne({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException('Матч не найден');
    }

    match.winnerId = winnerId;
    match.status = MatchStatus.FINISHED;
    await this.matchesRepository.save(match);

    await this.advanceTournament(match.tournamentId);
  }

  private async advanceTournament(tournamentId: string): Promise<void> {
    const tournament = await this.findOne(tournamentId);
    const unfinishedMatches = await this.matchesRepository.find({
      where: { tournamentId, status: MatchStatus.IN_PROGRESS },
    });

    if (unfinishedMatches.length === 0) {
      tournament.status = TournamentStatus.FINISHED;
      tournament.endDate = new Date();
      await this.tournamentsRepository.save(tournament);
    }
  }
}

