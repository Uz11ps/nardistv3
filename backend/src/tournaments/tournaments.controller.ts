import { Controller, Get, Post, Body, Param, UseGuards, Query, Req } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  async findAll(
    @Req() req: any,
    @Query('status') status?: string,
  ) {
    // Проверяем, есть ли авторизованный пользователь (но не требуем обязательной авторизации)
    // JWT guard не используется, но если токен есть и валиден, user будет в req
    const userId = req?.user?.id;
    return this.tournamentsService.findAll(status, userId);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  async register(@Param('id') id: string, @CurrentUser() user: any) {
    await this.tournamentsService.register(id, user.id);
    return { message: 'Регистрация успешна' };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }
}

