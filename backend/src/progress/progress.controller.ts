import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EnhancementType } from './enhancement.entity';
import { ProgressionBranchesService } from './progression-branches.service';

@Controller('progress')
export class ProgressController {
  constructor(
    private readonly progressService: ProgressService,
    private readonly branchesService: ProgressionBranchesService,
  ) {}

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

  @Post('skill-points/distribute')
  @UseGuards(JwtAuthGuard)
  async distributeSkillPoints(
    @CurrentUser() user: any,
    @Body('type') type: EnhancementType,
    @Body('amount') amount: number,
  ) {
    await this.progressService.distributeSkillPoints(user.id, type, amount);
    return { message: 'Skill Points распределены' };
  }

  @Get('skill-points')
  @UseGuards(JwtAuthGuard)
  async getSkillPoints(@CurrentUser() user: any) {
    const userEntity = await this.progressService['usersService'].findOne(user.id);
    return {
      total: userEntity.skillPoints || 0,
      free: userEntity.freeSkillPoints || 0,
      economy: userEntity.economySp || 0,
      energy: userEntity.energySp || 0,
      lives: userEntity.livesSp || 0,
      power: userEntity.powerSp || 0,
    };
  }

  @Get('level-progress')
  @UseGuards(JwtAuthGuard)
  async getLevelProgress(@CurrentUser() user: any) {
    return this.progressService.getLevelProgress(user.id);
  }

  @Get('enhancement/availability')
  @UseGuards(JwtAuthGuard)
  async getEnhancementAvailability(@CurrentUser() user: any) {
    return this.progressService.canChooseEnhancement(user.id);
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
    return { message: 'Жизни куплены' };
  }

  @Post('energy/buy')
  @UseGuards(JwtAuthGuard)
  async buyEnergy(@CurrentUser() user: any) {
    await this.progressService.buyEnergy(user.id);
    return { message: 'Энергия куплена' };
  }

  @Get('skin-weight-limit')
  @UseGuards(JwtAuthGuard)
  async getSkinWeightLimit(@CurrentUser() user: any) {
    const limit = await this.progressService.getSkinWeightLimit(user.id);
    return { limit };
  }

  @Post('business-license/buy')
  @UseGuards(JwtAuthGuard)
  async buyBusinessLicense(@CurrentUser() user: any) {
    await this.progressService.buyBusinessLicense(user.id);
    return { message: 'Лицензия предпринимателя приобретена' };
  }

  /**
   * Данные для "Бара нардистов" в магазине
   */
  @Get('shop-bar')
  @UseGuards(JwtAuthGuard)
  async getShopBar(@CurrentUser() user: any) {
    return this.progressService.getShopBarInfo(user.id);
  }

  @Get('level-reward/:level')
  @UseGuards(JwtAuthGuard)
  async getLevelReward(@Param('level') level: number) {
    const reward = this.progressService.getLevelRewardNAR(level);
    return { level: Number(level), reward };
  }
}
