import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser() user: any) {
    return this.onboardingService.getOnboardingStatus(user.id);
  }

  @Post('complete-profile')
  @UseGuards(JwtAuthGuard)
  async completeProfile(
    @CurrentUser() user: any,
    @Body() body: { nickname?: string; country?: string; gender?: string; avatarUrl?: string },
  ) {
    return this.onboardingService.completeProfileSetup(user.id, body);
  }

  @Get('starter-kit-info')
  @UseGuards(JwtAuthGuard)
  async getStarterKitInfo(@CurrentUser() user: any) {
    return this.onboardingService.getStarterKitInfo();
  }

  @Post('claim-starter-kit')
  @UseGuards(JwtAuthGuard)
  async claimStarterKit(@CurrentUser() user: any) {
    return this.onboardingService.claimStarterKit(user.id);
  }

  @Post('complete')
  @UseGuards(JwtAuthGuard)
  async complete(@CurrentUser() user: any) {
    return this.onboardingService.completeOnboarding(user.id);
  }
}

