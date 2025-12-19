import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('login')
  async adminLogin(@Body() loginDto: AdminLoginDto) {
    if (loginDto.login === '123' && loginDto.password === '123123') {
      // Создаем JWT токен для админа
      const payload = {
        sub: 'admin',
        login: '123',
        isAdmin: true,
      };
      const token = this.jwtService.sign(payload);
      return {
        access_token: token,
        user: {
          id: 'admin',
          login: '123',
          isAdmin: true,
        },
      };
    }
    throw new UnauthorizedException('Неверный логин или пароль');
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getStats();
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  async getUsers(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllUsers();
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard)
  async getUser(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getUserDetails(id);
  }

  @Post('users/:id/ban')
  @UseGuards(JwtAuthGuard)
  async banUser(@CurrentUser() user: any, @Param('id') id: string, @Body('reason') reason: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.banUser(id, reason);
  }

  @Post('users/:id/unban')
  @UseGuards(JwtAuthGuard)
  async unbanUser(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.unbanUser(id);
  }

  @Get('games')
  @UseGuards(JwtAuthGuard)
  async getGames(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllGames();
  }

  @Get('games/:id')
  @UseGuards(JwtAuthGuard)
  async getGame(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getGameDetails(id);
  }

  @Post('notifications')
  @UseGuards(JwtAuthGuard)
  async sendNotification(@CurrentUser() user: any, @Body() body: { userId?: string; message: string; all?: boolean }) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.sendNotification(body);
  }
}

