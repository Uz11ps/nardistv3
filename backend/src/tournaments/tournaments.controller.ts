import { Controller, Get, Post, Body, Param, UseGuards, Query, Req } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(
    @Req() req: any,
    @Query('status') status?: string,
  ) {
    // req.user будет заполнен OptionalJwtAuthGuard если токен валиден, иначе null
    const userId = req.user?.id;
    return this.tournamentsService.findAll(status, userId);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  async register(@Param('id') id: string, @CurrentUser() user: any) {
    await this.tournamentsService.register(id, user.id);
    return { message: 'Регистрация успешна' };
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.tournamentsService.findOne(id, userId);
  }

  @Get(':id/results')
  async getResults(@Param('id') id: string) {
    return this.tournamentsService.getTournamentResults(id);
  }

  @Get('tickets/my')
  @UseGuards(JwtAuthGuard)
  async getMyTickets(@CurrentUser() user: any) {
    const ticketsService = this.tournamentsService['ticketsService'];
    const tickets = await ticketsService.getUserTickets(user.id);
    const availableCount = await ticketsService.getAvailableTicketsCount(user.id);
    return {
      total: tickets.length,
      available: availableCount,
      used: tickets.filter(t => t.used).length,
      tickets: tickets.map(t => ({
        id: t.id,
        used: t.used,
        usedAt: t.usedAt,
        source: t.source,
        createdAt: t.createdAt,
      })),
    };
  }
}

