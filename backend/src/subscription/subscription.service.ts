import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionPlan } from './subscription.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionsRepository: Repository<Subscription>,
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

  async createSubscription(userId: string, plan: SubscriptionPlan): Promise<Subscription> {
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
    });

    return this.subscriptionsRepository.save(subscription);
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionsRepository.findOne({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }
}

