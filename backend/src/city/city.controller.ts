import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
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
    return this.cityService.getDistricts();
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

  @Post('districts/:districtId/capture')
  @UseGuards(JwtAuthGuard)
  async captureDistrict(@CurrentUser() user: any, @Param('districtId') districtId: string) {
    return this.cityService.captureDistrict(user.id, districtId);
  }

  @Post('upgrade/:buildingId')
  @UseGuards(JwtAuthGuard)
  async upgradeBuilding(@CurrentUser() user: any, @Param('buildingId') buildingId: string) {
    return this.cityService.upgradeBuilding(user.id, buildingId);
  }
}

