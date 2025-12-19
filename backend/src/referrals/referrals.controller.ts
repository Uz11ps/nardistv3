import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@CurrentUser() user: any) {
    return this.referralsService.getReferralStats(user.id);
  }

  @Post('use')
  @UseGuards(JwtAuthGuard)
  async useCode(@CurrentUser() user: any, @Body('code') code: string) {
    await this.referralsService.useReferralCode(user.id, code);
    return { message: 'Реферальный код применен' };
  }
}

