import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UsersService } from '../users/users.service';
import { ProgressService } from '../progress/progress.service';
import { ReferralEarning } from './referral-earning.entity';

@Injectable()
export class ReferralsService {
  private cachedBotUsername: string | null = null;

  constructor(
    private usersService: UsersService,
    private progressService: ProgressService,
    private configService: ConfigService,
    @InjectRepository(ReferralEarning)
    private referralEarningsRepository: Repository<ReferralEarning>,
  ) {}

  async useReferralCode(userId: string, referralCode: string): Promise<void> {
    const referrer = await this.usersService.findByReferralCode(referralCode);
    if (!referrer || referrer.id === userId) {
      throw new Error('Неверный реферальный код');
    }

    const user = await this.usersService.findOne(userId);
    if (user.referredBy) {
      throw new Error('Реферальный код уже использован');
    }

    user.referredBy = referrer.id;
    await this.usersService['usersRepository'].save(user);

    await this.progressService.addNarCoin(referrer.id, 500);
    await this.progressService.addXP(referrer.id, 100);
    await this.progressService.addNarCoin(userId, 200);
    await this.progressService.addXP(userId, 50);
  }

  async getReferralStats(userId: string): Promise<any> {
    const user = await this.usersService.findOne(userId);
    const referredUsers = await this.usersService['usersRepository'].find({
      where: { referredBy: userId },
    });

    // Получаем все доходы от рефералов
    const earnings = await this.referralEarningsRepository.find({
      where: { referrerId: userId },
      order: { createdAt: 'DESC' },
    });

    const totalEarnings = earnings.reduce((sum, e) => sum + Number(e.referralBonus), 0);

    // Формируем ссылку для Telegram бота
    // Формат: https://t.me/BOT_USERNAME?start=REFERRAL_CODE
    const botUsername = await this.getBotUsername();
    const referralLink = `https://t.me/${botUsername.replace('@', '')}?start=${user.referralCode}`;
    
    return {
      referralCode: user.referralCode,
      referralLink: referralLink,
      totalReferred: referredUsers.length,
      activeReferred: referredUsers.filter((u) => !u.isBanned).length,
      totalEarnings: totalEarnings,
      referralPercent: user.referralPercent || 5,
      referralBaseBonus: Number(user.referralBaseBonus || 100),
      earnings: earnings.map(e => ({
        id: e.id,
        referredUserId: e.referredUserId,
        donationAmount: Number(e.donationAmount),
        referralBonus: Number(e.referralBonus),
        description: e.description,
        createdAt: e.createdAt,
      })),
    };
  }

  /**
   * Начислить реферальный бонус при донате реферала
   */
  async processReferralBonus(referredUserId: string, donationAmount: number, description: string = 'Донат'): Promise<void> {
    const referredUser = await this.usersService.findOne(referredUserId);
    if (!referredUser || !referredUser.referredBy) {
      return; // У пользователя нет реферера
    }

    const referrer = await this.usersService.findOne(referredUser.referredBy);
    if (!referrer) {
      return; // Реферер не найден
    }

    // Получаем индивидуальные настройки реферера
    const referralPercent = referrer.referralPercent || 5;
    const referralBaseBonus = Number(referrer.referralBaseBonus || 100);

    // Вычисляем бонус: процент от доната + базовый бонус
    const percentBonus = Math.floor(donationAmount * (referralPercent / 100));
    const totalBonus = percentBonus + referralBaseBonus;

    // Начисляем бонус рефереру
    const currentBalance = Number(referrer.narCoin || 0);
    await this.usersService.update(referrer.id, {
      narCoin: currentBalance + totalBonus,
      totalReferralEarnings: BigInt(Number(referrer.totalReferralEarnings || 0) + totalBonus),
    });

    // Сохраняем запись о доходе
    const earning = this.referralEarningsRepository.create({
      referrerId: referrer.id,
      referredUserId: referredUserId,
      donationAmount: BigInt(donationAmount),
      referralBonus: BigInt(totalBonus),
      referralPercent: referralPercent,
      referralBaseBonus: BigInt(referralBaseBonus),
      description: description,
    });
    await this.referralEarningsRepository.save(earning);
  }

  /**
   * Получить имя бота из переменных окружения или через API
   */
  private async getBotUsername(): Promise<string> {
    // Используем кеш, если уже получали
    if (this.cachedBotUsername) {
      return this.cachedBotUsername;
    }

    // Сначала проверяем переменные окружения
    let botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');
    if (botUsername) {
      this.cachedBotUsername = botUsername.replace('@', '');
      return this.cachedBotUsername;
    }

    // Если не указано, пытаемся получить через API
    try {
      const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
      if (botToken) {
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
        botUsername = response.data?.result?.username;
        if (botUsername) {
          this.cachedBotUsername = botUsername.replace('@', '');
          return this.cachedBotUsername;
        }
      }
    } catch (error) {
      // Игнорируем ошибки
    }

    // Fallback на дефолтное значение
    this.cachedBotUsername = 'nardist_bot';
    return this.cachedBotUsername;
  }
}

