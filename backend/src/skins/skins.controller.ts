import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { SkinsService } from './skins.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('skins')
export class SkinsController {
  constructor(private readonly skinsService: SkinsService) {}

  @Get()
  async getAllSkins() {
    return this.skinsService.getAllSkins();
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMySkins(@CurrentUser() user: any) {
    return this.skinsService.getUserSkins(user.id);
  }

  @Get('my/with-durability')
  @UseGuards(JwtAuthGuard)
  async getMySkinsWithDurability(@CurrentUser() user: any) {
    return this.skinsService.getUserSkinsWithDurability(user.id);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserSkins(@Param('userId') userId: string) {
    return this.skinsService.getUserSkins(userId);
  }

  @Get('selected')
  @UseGuards(JwtAuthGuard)
  async getSelectedSkin(@CurrentUser() user: any) {
    return this.skinsService.getSelectedSkin(user.id);
  }

  @Get('selected/explicit')
  @UseGuards(JwtAuthGuard)
  async getExplicitlySelectedSkins(@CurrentUser() user: any) {
    // Возвращает ТОЛЬКО явно выбранные скины (без fallback на дефолтные)
    return this.skinsService.getExplicitlySelectedSkins(user.id);
  }

  @Get('user/:userId/selected')
  @UseGuards(JwtAuthGuard)
  async getUserSelectedSkin(@Param('userId') userId: string) {
    return this.skinsService.getSelectedSkin(userId);
  }

  @Post('select')
  @UseGuards(JwtAuthGuard)
  async selectSkin(@CurrentUser() user: any, @Body('skinId') skinId: string) {
    await this.skinsService.selectSkin(user.id, skinId);
    return { message: 'Скин выбран' };
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseSkin(@CurrentUser() user: any, @Body('skinId') skinId: string) {
    await this.skinsService.purchaseSkin(user.id, skinId);
    return { message: 'Скин куплен' };
  }

  @Get(':id/repair-cost')
  @UseGuards(JwtAuthGuard)
  async getRepairCost(@CurrentUser() user: any, @Param('id') skinId: string) {
    const cost = await this.skinsService.calculateRepairCost(user.id, skinId);
    return { cost };
  }

  @Post(':id/repair')
  @UseGuards(JwtAuthGuard)
  async repairSkin(@CurrentUser() user: any, @Param('id') skinId: string) {
    await this.skinsService.repairSkin(user.id, skinId);
    return { message: 'Скин отремонтирован' };
  }
}

