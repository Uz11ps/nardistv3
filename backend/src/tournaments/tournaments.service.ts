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
    const tournament = this.tournamentsRepository.create(tournamentData);
    return this.tournamentsRepository.save(tournament);
  }

  async findAll(status?: string): Promise<Tournament[]> {
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
    });

    // Добавляем информацию о регистрации пользователя (требует userId из контекста)
    return tournaments.map(t => ({
      ...t,
      entryFee: 150, // Заглушка, должна браться из настроек турнира
      prizePool: t.currentParticipants * 150, // Заглушка
      registered: false, // Требует проверки через userId
    }));
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

    const existingMatch = await this.matchesRepository.findOne({
      where: { tournamentId, player1Id: userId },
    });

    if (existingMatch) {
      throw new BadRequestException('Вы уже зарегистрированы');
    }

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

