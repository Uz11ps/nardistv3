import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BusinessService } from './business.service';
import { MaterialService } from './material.service';
import { LicenseService } from './license.service';
import { LocationService } from './location.service';
import { DistrictName } from './district.entity';

@Controller('business')
@UseGuards(JwtAuthGuard)
export class BusinessController {
  constructor(
    private businessService: BusinessService,
    private materialService: MaterialService,
    private licenseService: LicenseService,
    private locationService: LocationService,
  ) {}

  @Get('districts')
  async getDistricts() {
    // TODO: реализовать получение списка районов
    return { districts: [] };
  }

  @Get('districts/:district/businesses')
  async getBusinessesByDistrict(@Param('district') district: string) {
    return this.businessService.getBusinessesByDistrict(district as DistrictName);
  }

  @Get('my-businesses')
  async getMyBusinesses(@CurrentUser() user: any) {
    return this.businessService.getPlayerBusinesses(user.id);
  }

  @Get('businesses/:id')
  async getBusinessInfo(@Param('id') id: string, @CurrentUser() user: any) {
    return this.businessService.getBusinessInfo(id, user.id);
  }

  @Post('purchase')
  async purchaseBusiness(@CurrentUser() user: any, @Body() body: { businessId: string }) {
    return this.businessService.purchaseBusiness(user.id, body.businessId);
  }

  @Post('upgrade')
  async upgradeBusiness(@CurrentUser() user: any, @Body() body: { playerBusinessId: string }) {
    return this.businessService.upgradeBusiness(user.id, body.playerBusinessId);
  }

  @Post('collect')
  async collectProfit(@CurrentUser() user: any, @Body() body: { playerBusinessId: string }) {
    return this.businessService.collectProfit(user.id, body.playerBusinessId);
  }

  @Get('materials')
  async getMyMaterials(@CurrentUser() user: any) {
    return this.materialService.getPlayerMaterials(user.id);
  }

  @Get('licenses')
  async getAllLicenses() {
    return this.licenseService.getAllLicenses();
  }

  @Get('my-licenses')
  async getMyLicenses(@CurrentUser() user: any) {
    return this.licenseService.getPlayerLicenses(user.id);
  }

  @Post('licenses/purchase')
  async purchaseLicense(@CurrentUser() user: any, @Body() body: { licenseId: string }) {
    return this.licenseService.purchaseLicense(user.id, body.licenseId);
  }

  @Get('location')
  async getLocation(@CurrentUser() user: any) {
    return this.locationService.getPlayerLocation(user.id);
  }

  @Post('travel')
  async startTravel(@CurrentUser() user: any, @Body() body: { targetDistrict: string }) {
    return this.locationService.startTravel(user.id, body.targetDistrict as DistrictName);
  }
}

