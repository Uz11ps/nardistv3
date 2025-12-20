import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionPlan } from './subscription.entity';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser() user: any) {
    const hasActive = await this.subscriptionService.hasActiveSubscription(user.id);
    return { hasActive };
  }

  @Get('plans')
  async getPlans() {
    return [
      { id: 'month_1', name: '1 месяц', price: 3, currency: 'TON', badge: 'Попробовать' },
      { id: 'month_3', name: '3 месяца', price: 7, currency: 'TON', badge: 'Оптимально', popular: true },
      { id: 'month_12', name: '1 год', price: 22, currency: 'TON', badge: 'Выгоднее' },
    ];
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  async purchase(@CurrentUser() user: any, @Body() body: { plan: SubscriptionPlan }) {
    return this.subscriptionService.createSubscription(user.id, body.plan);
  }
}

