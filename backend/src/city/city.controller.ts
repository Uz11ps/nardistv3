import { Controller, Get, Post, Param, UseGuards, Body, Query } from '@nestjs/common';
import { CityService } from './city.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('city')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getCity(@CurrentUser() user: any) {
    return this.cityService.getCity(user.id);
  }

  @Get('districts')
  @UseGuards(JwtAuthGuard)
  async getDistricts(@CurrentUser() user: any) {
    return this.cityService.getDistricts(user.id);
  }

  @Post('buildings/purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseBuilding(
    @CurrentUser() user: any,
    @Body() body: { district: string; type: string },
  ) {
    return this.cityService.purchaseBuilding(user.id, body.district as any, body.type as any);
  }

  @Get('buildings')
  @UseGuards(JwtAuthGuard)
  async getBuildings(@CurrentUser() user: any) {
    return this.cityService.getUserBuildings(user.id);
  }

  @Post('buildings/:buildingId/collect')
  @UseGuards(JwtAuthGuard)
  async collectIncome(@CurrentUser() user: any, @Param('buildingId') buildingId: string) {
    const income = await this.cityService.collectIncome(user.id, buildingId);
    return { income };
  }

  @Post('buildings/:buildingId/capture')
  @UseGuards(JwtAuthGuard)
  async captureTerritory(@CurrentUser() user: any, @Param('buildingId') buildingId: string) {
    await this.cityService.captureTerritory(user.id, buildingId);
    return { message: 'Территория успешно захвачена' };
  }

  @Post('upgrade/:buildingId')
  @UseGuards(JwtAuthGuard)
  async upgradeBuilding(@CurrentUser() user: any, @Param('buildingId') buildingId: string) {
    return this.cityService.upgradeBuilding(user.id, buildingId);
  }

  @Get('captureable')
  @UseGuards(JwtAuthGuard)
  async getCaptureableBuildings(
    @CurrentUser() user: any,
    @Query('district') district?: string,
  ) {
    return this.cityService.getCaptureableBuildings(user.id, district as any);
  }
}

