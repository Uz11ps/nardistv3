import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    return this.tournamentsService.findAll(status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  async register(@Param('id') id: string, @CurrentUser() user: any) {
    await this.tournamentsService.register(id, user.id);
    return { message: 'Регистрация успешна' };
  }
}

