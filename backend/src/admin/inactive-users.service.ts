import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { AdminService } from './admin.service';

@Injectable()
export class InactiveUsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
  ) {}

  // Проверяем неактивных пользователей (не заходили более месяца - 30 дней)
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async checkInactiveUsers() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const inactiveUsers = await this.usersRepository
        .createQueryBuilder('user')
        .where('user.isBanned = false')
        .andWhere('user.isGuest = false')
        .andWhere('user.telegramId IS NOT NULL')
        .andWhere('(user.lastLogin IS NULL OR user.lastLogin < :thirtyDaysAgo)', { thirtyDaysAgo })
        .andWhere('(user.lastInactiveNotification IS NULL OR user.lastInactiveNotification < :thirtyDaysAgo)', { thirtyDaysAgo })
        .getMany();

      for (const user of inactiveUsers) {
        try {
          await this.adminService.sendInactiveUserNotification(user.id);
        } catch (error) {
          console.error(`Ошибка при отправке Telegram уведомления пользователю ${user.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Ошибка при проверке неактивных пользователей:', error);
    }
  }
}

