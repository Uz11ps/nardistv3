import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    console.log('📥 Получен запрос на /auth/login');
    console.log('📥 initData длина:', loginDto.initData?.length || 0);
    console.log('📥 initData первые 100 символов:', loginDto.initData?.substring(0, 100) || 'пусто');
    
    if (!loginDto.initData || loginDto.initData.trim() === '') {
      console.error('❌ initData пустой в запросе');
      throw new UnauthorizedException('initData не предоставлен');
    }
    
    try {
      return await this.authService.login(loginDto.initData);
    } catch (error: any) {
      console.error('❌ Ошибка в auth.controller.login:', error.message);
      console.error('❌ Stack:', error.stack);
      throw error;
    }
  }
  
  @Post('test-init-data')
  async testInitData(@Body() body: { initData?: string }) {
    // Тестовый endpoint для проверки initData без авторизации
    console.log('🧪 Тестовый запрос initData');
    console.log('🧪 initData:', body.initData ? `есть (${body.initData.length} символов)` : 'отсутствует');
    
    if (!body.initData) {
      return {
        success: false,
        message: 'initData не предоставлен',
        hint: 'Проверьте что вы открыли приложение через Telegram бота и домен привязан к боту',
      };
    }
    
    try {
      const userData = await this.authService.verifyTelegramInitData(body.initData);
      return {
        success: true,
        message: 'initData валиден',
        userData: {
          id: userData.id,
          username: userData.username,
          first_name: userData.first_name,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.constructor.name,
      };
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return user;
  }
}

