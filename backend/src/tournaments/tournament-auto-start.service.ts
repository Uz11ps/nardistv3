import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TournamentsService } from './tournaments.service';

@Injectable()
export class TournamentAutoStartService {
  private readonly logger = new Logger(TournamentAutoStartService.name);

  constructor(private readonly tournamentsService: TournamentsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndStart() {
    const readyTournaments = await this.tournamentsService.findReadyToStart();
    if (readyTournaments.length === 0) {
      return;
    }

    for (const tournament of readyTournaments) {
      try {
        await this.tournamentsService.startTournament(tournament.id);
        this.logger.log(`Автостарт турнира ${tournament.id} (${tournament.name})`);
      } catch (error) {
        this.logger.error(
          `Не удалось автоматически запустить турнир ${tournament.id}:`,
          error,
        );
      }
    }
  }
}

