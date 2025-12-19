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

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  async purchase(@CurrentUser() user: any, @Body('plan') plan: SubscriptionPlan) {
    return this.subscriptionService.createSubscription(user.id, plan);
  }
}

