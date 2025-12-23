import { Controller, Get, Put, Param, UseGuards, Post, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getNotifications(@CurrentUser() user: any) {
    return this.notificationsService.getUserNotifications(user.id);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@CurrentUser() user: any) {
    try {
      if (!user || !user.id) {
        console.error('❌ Notifications unread-count: пользователь не найден:', user);
        return { count: 0 };
      }
      const count = await this.notificationsService.getUnreadCount(user.id);
      return { count };
    } catch (error) {
      console.error('❌ Ошибка при получении количества непрочитанных уведомлений:', error);
      return { count: 0 };
    }
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Post('mark-all-read')
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(@CurrentUser() user: any) {
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }
}

