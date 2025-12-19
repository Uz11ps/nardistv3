import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getUsers(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new Error('Недостаточно прав');
    }
    return this.adminService.getAllUsers();
  }

  @Post('users/:id/ban')
  async banUser(@CurrentUser() user: any, @Param('id') id: string, @Body('reason') reason: string) {
    if (!user.isAdmin) {
      throw new Error('Недостаточно прав');
    }
    return this.adminService.banUser(id, reason);
  }

  @Post('users/:id/unban')
  async unbanUser(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new Error('Недостаточно прав');
    }
    return this.adminService.unbanUser(id);
  }
}

