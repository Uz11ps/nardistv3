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

  @Get('energy')
  @UseGuards(JwtAuthGuard)
  async getEnergy(@CurrentUser() user: any) {
    try {
      if (!user || !user.id) {
        console.error('❌ Progress energy: пользователь не найден:', user);
        return { energy: 100, maxEnergy: 100, lastRestore: null };
      }
      await this.progressService.restoreEnergy(user.id);
      const userEntity = await this.progressService['usersService'].findOne(user.id);
      return {
        energy: userEntity.energy,
        maxEnergy: userEntity.maxEnergy,
        lastRestore: userEntity.lastEnergyRestore,
      };
    } catch (error) {
      console.error('❌ Ошибка при получении энергии:', error);
      return { energy: 100, maxEnergy: 100, lastRestore: null };
    }
  }

  @Get('lives')
  @UseGuards(JwtAuthGuard)
  async getLives(@CurrentUser() user: any) {
    await this.progressService.restoreLives(user.id);
    const userEntity = await this.progressService['usersService'].findOne(user.id);
    return {
      lives: userEntity.lives,
      maxLives: userEntity.maxLives,
      lastRestore: userEntity.lastLifeRestore,
    };
  }

  @Post('lives/buy')
  @UseGuards(JwtAuthGuard)
  async buyLife(@CurrentUser() user: any) {
    await this.progressService.buyLife(user.id);
    return { message: 'Жизнь куплена' };
  }

  @Get('skin-weight-limit')
  @UseGuards(JwtAuthGuard)
  async getSkinWeightLimit(@CurrentUser() user: any) {
    const limit = await this.progressService.getSkinWeightLimit(user.id);
    return { limit };
  }
}

