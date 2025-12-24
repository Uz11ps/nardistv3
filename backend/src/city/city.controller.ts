import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { CityService } from './city.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('city')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  @Get('buildings')
  @UseGuards(JwtAuthGuard)
  async getAvailableBuildings(@CurrentUser() user: any) {
    return this.cityService.getAvailableBuildings(user.id);
  }

  @Get('my-buildings')
  @UseGuards(JwtAuthGuard)
  async getMyBuildings(@CurrentUser() user: any) {
    return this.cityService.getUserBuildings(user.id);
  }

  @Post('buildings/purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseBuilding(
    @CurrentUser() user: any,
    @Body() body: { buildingConfigId: string },
  ) {
    return this.cityService.purchaseBuilding(user.id, body.buildingConfigId);
  }

  @Put('buildings/:id/upgrade')
  @UseGuards(JwtAuthGuard)
  async upgradeBuilding(@CurrentUser() user: any, @Param('id') id: string) {
    return this.cityService.upgradeBuilding(user.id, id);
  }

  @Post('buildings/:id/collect')
  @UseGuards(JwtAuthGuard)
  async collectIncome(@CurrentUser() user: any, @Param('id') id: string) {
    return this.cityService.collectIncome(user.id, id);
  }

  @Get('autobuild/settings')
  @UseGuards(JwtAuthGuard)
  async getAutobuildSettings(@CurrentUser() user: any) {
    return this.cityService.getAutobuildSettings(user.id);
  }

  @Post('autobuild/settings')
  @UseGuards(JwtAuthGuard)
  async saveAutobuildSettings(
    @CurrentUser() user: any,
    @Body() body: { minBalance: number; strategy: string; priorityBuilding?: string | null },
  ) {
    return this.cityService.saveAutobuildSettings(user.id, body);
  }

  @Get('districts')
  @UseGuards(JwtAuthGuard)
  async getDistricts(@CurrentUser() user: any) {
    // Получаем все районы (для отображения в городе)
    return this.cityService.getAvailableDistrictsForCapture(null);
  }

  @Get('districts/available-for-capture')
  @UseGuards(JwtAuthGuard)
  async getAvailableDistrictsForCapture(@CurrentUser() user: any) {
    // Получаем клан пользователя, если есть
    const userClan = await this.cityService['clansService'].getUserClan(user.id);
    const clanId = userClan?.clan?.id || null;
    return this.cityService.getAvailableDistrictsForCapture(clanId);
  }
}

