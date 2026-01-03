import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TournamentsService } from './tournaments.service';
import { TournamentStatus } from './tournament.entity';
import axios from 'axios';

@Injectable()
export class TournamentAutoStartService {
  private readonly logger = new Logger(TournamentAutoStartService.name);
  private readonly botToken: string;
  private readonly notificationSent = new Set<string>(); // Кэш для отслеживания отправленных уведомлений

  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly configService: ConfigService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
  }

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

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndNotify() {
    try {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      
      // Находим турниры, которые начинаются через 5 минут
      const tournamentsToNotify = await this.tournamentsService.findTournamentsStartingAt(fiveMinutesFromNow);
      
      for (const tournament of tournamentsToNotify) {
        const cacheKey = `${tournament.id}-${tournament.startDate.getTime()}`;
        
        // Проверяем, не отправляли ли уже уведомление
        if (this.notificationSent.has(cacheKey)) {
          continue;
        }
        
        try {
          await this.sendNotificationToRegisteredPlayers(tournament);
          this.notificationSent.add(cacheKey);
          this.logger.log(`Отправлены уведомления о турнире ${tournament.id} (${tournament.name})`);
        } catch (error) {
          this.logger.error(
            `Не удалось отправить уведомления о турнире ${tournament.id}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Ошибка при проверке уведомлений о турнирах: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkMatchTimeouts() {
    try {
      await this.tournamentsService.checkAndProcessMatchTimeouts();
    } catch (error) {
      this.logger.error(`Ошибка при проверке таймаутов матчей: ${error.message}`);
    }
  }

  private async sendNotificationToRegisteredPlayers(tournament: any): Promise<void> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не настроен, уведомления не будут отправлены');
      return;
    }

    const registeredPlayers = await this.tournamentsService.getRegisteredPlayers(tournament.id);
    
    for (const playerId of registeredPlayers) {
      try {
        const user = await this.tournamentsService.getUserById(playerId);
        if (!user || !user.telegramId) {
          continue;
        }

        const message = `🏆 Турнир "${tournament.name}" начнется через 5 минут! Приготовьтесь к игре.`;
        
        await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
          chat_id: user.telegramId,
          text: message,
        });
      } catch (error: any) {
        this.logger.warn(`Не удалось отправить уведомление пользователю ${playerId}: ${error.message}`);
      }
    }
  }
}

