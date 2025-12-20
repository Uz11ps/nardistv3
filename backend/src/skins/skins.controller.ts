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
}

