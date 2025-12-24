import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentTicket } from './tournament-ticket.entity';

/**
 * Сервис для управления билетами на турниры
 */
@Injectable()
export class TournamentTicketsService {
  private readonly logger = new Logger(TournamentTicketsService.name);

  constructor(
    @InjectRepository(TournamentTicket)
    private ticketsRepository: Repository<TournamentTicket>,
  ) {}

  /**
   * Добавить билеты пользователю
   */
  async addTickets(userId: string, count: number, source: string = 'quest', questId?: string): Promise<void> {
    for (let i = 0; i < count; i++) {
      const ticket = this.ticketsRepository.create({
        userId,
        source,
        questId,
        used: false,
      });
      await this.ticketsRepository.save(ticket);
    }
    
    this.logger.log(`✅ Добавлено ${count} билетов пользователю ${userId} (источник: ${source})`);
  }

  /**
   * Получить количество доступных билетов пользователя
   */
  async getAvailableTicketsCount(userId: string, tournamentId?: string): Promise<number> {
    const query: any = {
      userId,
      used: false,
    };

    // Если указан турнир, проверяем универсальные билеты или билеты для этого турнира
    if (tournamentId) {
      query.tournamentId = null; // Универсальные билеты
    }

    return this.ticketsRepository.count({ where: query });
  }

  /**
   * Использовать билет для участия в турнире
   */
  async useTicket(userId: string, tournamentId: string): Promise<boolean> {
    // Ищем доступный билет (универсальный или для этого турнира)
    const ticket = await this.ticketsRepository.findOne({
      where: {
        userId,
        used: false,
        tournamentId: null, // Универсальный билет
      },
      order: { createdAt: 'ASC' }, // Используем старейший билет
    });

    if (!ticket) {
      return false;
    }

    ticket.used = true;
    ticket.usedAt = new Date();
    ticket.usedInTournamentId = tournamentId;
    await this.ticketsRepository.save(ticket);

    this.logger.log(`✅ Билет ${ticket.id} использован пользователем ${userId} для турнира ${tournamentId}`);
    return true;
  }

  /**
   * Получить все билеты пользователя
   */
  async getUserTickets(userId: string): Promise<TournamentTicket[]> {
    return this.ticketsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}

