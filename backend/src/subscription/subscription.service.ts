import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionPlan } from './subscription.entity';
import { UsersService } from '../users/users.service';
import { PaymentTransaction } from '../payment/payment-transaction.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionsRepository: Repository<Subscription>,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
  ) {}

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.subscriptionsRepository.findOne({
      where: { userId, isActive: true },
    });

    if (!subscription) {
      return false;
    }

    if (subscription.endDate < new Date()) {
      subscription.isActive = false;
      await this.subscriptionsRepository.save(subscription);
      return false;
    }

    return true;
  }

  async createSubscription(
    userId: string,
    plan: SubscriptionPlan,
    paymentTransactionId?: string,
  ): Promise<Subscription> {
    const months = plan === SubscriptionPlan.MONTH_1 ? 1 : plan === SubscriptionPlan.MONTH_3 ? 3 : 12;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    // Деактивируем предыдущие активные подписки
    await this.subscriptionsRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );

    const subscription = this.subscriptionsRepository.create({
      userId,
      plan,
      startDate,
      endDate,
      isActive: true,
      paymentTransactionId,
    });

    return this.subscriptionsRepository.save(subscription);
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionsRepository.findOne({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Покупка автобилда города навсегда
   * @param userId ID пользователя
   * @param paymentMethod Метод оплаты: 'usd' (50$) или 'nar' (10000 NAR-coin)
   */
  async purchaseCityAutobuild(userId: string, paymentMethod: 'usd' | 'nar'): Promise<void> {
    const user = await this.usersService.findOne(userId);

    if (user.hasCityAutobuild) {
      throw new BadRequestException('Автобилд города уже куплен');
    }

    if (paymentMethod === 'nar') {
      // Покупка за NAR-coin
      const requiredNar = 10000;
      const userBalance = Number(user.narCoin);

      if (userBalance < requiredNar) {
        throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${requiredNar}, у вас: ${userBalance}`);
      }

      // Списываем средства
      const newBalance = userBalance - requiredNar;
      await this.usersService.update(userId, { narCoin: newBalance });
      // Обновляем локальную переменную user после списания
      user.narCoin = BigInt(newBalance);
    } else if (paymentMethod === 'usd') {
      // Покупка за доллары (50$)
      // TODO: Интеграция с платежной системой для обработки платежа в долларах
      // Пока что просто проверяем, что метод выбран
      throw new BadRequestException('Оплата в долларах пока не реализована. Используйте NAR-coin.');
    } else {
      throw new BadRequestException('Неверный метод оплаты');
    }

    // Активируем автобилд
    user.hasCityAutobuild = true;
    await this.usersService['usersRepository'].save(user);
  }

  /**
   * Проверяет, есть ли у пользователя автобилд города
   */
  async hasCityAutobuild(userId: string): Promise<boolean> {
    const user = await this.usersService.findOne(userId);
    return user.hasCityAutobuild || false;
  }
}

