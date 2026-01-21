import { Controller, Get, Post, Param, UseGuards, Query } from '@nestjs/common';
import { QuestsService } from './quests.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get(':type')
  @UseGuards(JwtAuthGuard)
  async getQuests(@CurrentUser() user: any, @Param('type') type: string) {
    return this.questsService.getQuestsByType(user.id, type);
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  async claimQuest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.questsService.claimQuest(user.id, id);
  }

  @Post(':id/check-subscription')
  @UseGuards(JwtAuthGuard)
  async checkChannelSubscription(@CurrentUser() user: any, @Param('id') id: string) {
    const isSubscribed = await this.questsService.checkChannelSubscription(user.id, id);
    return { subscribed: isSubscribed };
  }

  @Get('onboarding/list')
  @UseGuards(JwtAuthGuard)
  async getOnboardingQuests(@CurrentUser() user: any) {
    return this.questsService.getOnboardingQuests(user.id);
  }

  @Get('onboarding/:id')
  @UseGuards(JwtAuthGuard)
  async getOnboardingQuestDetail(@CurrentUser() user: any, @Param('id') id: string) {
    return this.questsService.getOnboardingQuestDetail(user.id, id);
  }
}
