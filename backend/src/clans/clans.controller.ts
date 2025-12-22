import { Controller, Get, Post, Body, Param, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { ClansService } from './clans.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('clans')
export class ClansController {
  constructor(private readonly clansService: ClansService) {}

  @Get()
  async findAll(@Query('type') type?: string, @Query('search') search?: string) {
    const filters: any = {};
    if (type === 'active') filters.active = true;
    if (type === 'new') filters.new = true;
    if (type === 'top') filters.top = true;
    if (search) filters.search = search;

    return this.clansService.findAll(filters);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyClan(@CurrentUser() user: any) {
    return this.clansService.getUserClan(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.clansService.findOne(id);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  async getMembers(@Param('id') id: string) {
    return this.clansService.getMembers(id);
  }

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: any, @Body() body: { name: string; description?: string }) {
    return this.clansService.create(user.id, body.name, body.description);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  async join(@CurrentUser() user: any, @Param('id') id: string) {
    await this.clansService.join(user.id, id);
    return { message: 'Вы успешно вступили в клан' };
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  async leave(@CurrentUser() user: any, @Param('id') id: string) {
    await this.clansService.leave(user.id, id);
    return { message: 'Вы покинули клан' };
  }

  @Post(':id/contribute')
  @UseGuards(JwtAuthGuard)
  async contribute(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { amount: number },
  ) {
    await this.clansService.contribute(user.id, id, body.amount);
    return { message: 'Вклад внесен' };
  }

  @Post(':id/upgrade')
  @UseGuards(JwtAuthGuard)
  async upgrade(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { upgradeType: string },
  ) {
    return this.clansService.upgradeClan(user.id, id, body.upgradeType);
  }

  @Get(':id/treasury/transactions')
  @UseGuards(JwtAuthGuard)
  async getTreasuryTransactions(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.clansService.getTreasuryTransactions(id, limit ? parseInt(limit) : 10);
  }

  @Get(':id/upgrades')
  @UseGuards(JwtAuthGuard)
  async getUpgrades(@Param('id') id: string) {
    return this.clansService.getClanUpgrades(id);
  }

  @Get(':id/territories')
  @UseGuards(JwtAuthGuard)
  async getClanTerritories(@Param('id') id: string) {
    return this.clansService.getClanTerritories(id);
  }

  @Get(':id/territories/available')
  @UseGuards(JwtAuthGuard)
  async getAvailableTerritories(@Param('id') id: string) {
    return this.clansService.getAvailableTerritoriesForCapture(id);
  }

  @Get(':id/territories/capture-status')
  @UseGuards(JwtAuthGuard)
  async getCaptureStatus(@Param('id') id: string) {
    return this.clansService.canClanCaptureTerritory(id);
  }

  @Post(':id/territories/capture')
  @UseGuards(JwtAuthGuard)
  async captureTerritory(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { buildingId: string },
  ) {
    // Проверяем что пользователь состоит в этом клане
    const userClan = await this.clansService.getUserClan(user.id);
    if (!userClan || !userClan.clan || userClan.clan.id !== id) {
      throw new BadRequestException('Вы должны состоять в этом клане');
    }

    // Проверяем права
    if (!userClan.member || (userClan.member.role !== 'leader' && userClan.member.role !== 'officer')) {
      throw new BadRequestException('Только лидер и офицеры могут захватывать территории');
    }

    // Используем CityService через ClansService
    await this.clansService.captureTerritoryForClan(user.id, id, body.buildingId);
    return { message: 'Территория успешно захвачена' };
  }
}

