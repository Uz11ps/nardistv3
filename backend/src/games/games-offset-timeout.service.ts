import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GamesService } from './games.service';

@Injectable()
export class GamesOffsetTimeoutService {
  private readonly logger = new Logger(GamesOffsetTimeoutService.name);

  constructor(private readonly gamesService: GamesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkOffsetTimeouts() {
    try {
      await this.gamesService.checkAndProcessOffsetTimeouts();
    } catch (error) {
      this.logger.error(`Ошибка при проверке таймаутов выбора смещения: ${error.message}`);
    }
  }
}

