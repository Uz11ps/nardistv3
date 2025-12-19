import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EnhancementType } from './enhancement.entity';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('enhancements')
  @UseGuards(JwtAuthGuard)
  async getEnhancements(@CurrentUser() user: any) {
    return this.progressService.getEnhancements(user.id);
  }

  @Post('enhancement')
  @UseGuards(JwtAuthGuard)
  async chooseEnhancement(@CurrentUser() user: any, @Body('type') type: EnhancementType) {
    await this.progressService.chooseEnhancement(user.id, type);
    return { message: 'Усиление выбрано' };
  }
}

