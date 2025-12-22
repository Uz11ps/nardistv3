import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from './user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BirthdayService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  // Проверяем дни рождения каждый день в 00:00
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkBirthdays() {
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // getMonth() возвращает 0-11
    const todayDay = today.getDate();

    try {
      // Находим всех пользователей, у которых сегодня день рождения
      const users = await this.usersRepository
        .createQueryBuilder('user')
        .where('EXTRACT(MONTH FROM user.birthday) = :month', { month: todayMonth })
        .andWhere('EXTRACT(DAY FROM user.birthday) = :day', { day: todayDay })
        .andWhere('user.isBanned = false')
        .andWhere('user.birthday IS NOT NULL')
        .getMany();

      for (const user of users) {
        // Проверяем, не получал ли пользователь подарок в этом году
        const lastGiftYear = user.lastBirthdayGift
          ? new Date(user.lastBirthdayGift).getFullYear()
          : null;
        const currentYear = today.getFullYear();

        if (lastGiftYear !== currentYear) {
          // Дарим 100 NAR
          const currentNarCoin = typeof user.narCoin === 'bigint' 
            ? Number(user.narCoin) 
            : (user.narCoin || 0);
          user.narCoin = BigInt(currentNarCoin + 100);
          user.lastBirthdayGift = today;
          await this.usersRepository.save(user);

          // Отправляем уведомление
          await this.notificationsService.createNotification(
            user.id,
            '🎉 С Днем Рождения!',
            'Поздравляем с днем рождения! Вам начислено 100 NAR в подарок!',
            'success',
          );
        }
      }
    } catch (error) {
      console.error('Ошибка при проверке дней рождения:', error);
    }
  }

  // Проверка дня рождения для конкретного пользователя (вызывается при логине)
  async checkUserBirthday(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user || !user.birthday || user.isBanned) {
      return false;
    }

    const today = new Date();
    const birthday = new Date(user.birthday);
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const birthdayMonth = birthday.getMonth() + 1;
    const birthdayDay = birthday.getDate();

    if (todayMonth === birthdayMonth && todayDay === birthdayDay) {
      // Проверяем, не получал ли пользователь подарок в этом году
      const lastGiftYear = user.lastBirthdayGift
        ? new Date(user.lastBirthdayGift).getFullYear()
        : null;
      const currentYear = today.getFullYear();

      if (lastGiftYear !== currentYear) {
        // Дарим 100 NAR
        const currentNarCoin = typeof user.narCoin === 'bigint' 
          ? Number(user.narCoin) 
          : (user.narCoin || 0);
        user.narCoin = BigInt(currentNarCoin + 100);
        user.lastBirthdayGift = today;
        await this.usersRepository.save(user);

        // Отправляем уведомление
        await this.notificationsService.createNotification(
          user.id,
          '🎉 С Днем Рождения!',
          'Поздравляем с днем рождения! Вам начислено 100 NAR в подарок!',
          'success',
        );
        return true;
      }
    }
    return false;
  }

}

