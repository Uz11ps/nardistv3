import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  async verifyTelegramInitData(initData: string): Promise<any> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN не настроен');
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) {
      throw new UnauthorizedException('Отсутствует hash в initData');
    }
    urlParams.delete('hash');

    // Формируем строку для проверки из всех параметров кроме hash
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Вычисляем секретный ключ из токена бота
    // secret_key = HMAC-SHA256("WebAppData", bot_token)
    const secretKeyBuffer = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем hash от dataCheckString используя секретный ключ
    // calculated_hash = HMAC-SHA256(secret_key, data_check_string)
    const calculatedHash = crypto
      .createHmac('sha256', secretKeyBuffer)
      .update(dataCheckString)
      .digest('hex');

    // Сравниваем вычисленный hash с переданным
    if (calculatedHash !== hash) {
      throw new UnauthorizedException('Неверная подпись Telegram initData');
    }

    // Извлекаем данные пользователя
    const userData = JSON.parse(urlParams.get('user') || '{}');
    const authDate = parseInt(urlParams.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);

    // Проверяем что данные не устарели (не старше 24 часов)
    if (now - authDate > 86400) {
      throw new UnauthorizedException('Данные авторизации устарели');
    }

    return userData;
  }

  async login(initData: string) {
    const telegramUser = await this.verifyTelegramInitData(initData);
    
    let user = await this.usersService.findByTelegramId(telegramUser.id.toString());
    const isNewUser = !user;
    
    if (!user) {
      const createUserDto: CreateUserDto = {
        telegramId: telegramUser.id.toString(),
        username: telegramUser.username || `user_${telegramUser.id}`,
        firstName: telegramUser.first_name || '',
        lastName: telegramUser.last_name || '',
        languageCode: telegramUser.language_code || 'ru',
        avatarUrl: telegramUser.photo_url || '',
      };
      user = await this.usersService.create(createUserDto);
      
      // Новый пользователь - онбординг не пройден
      user.onboardingCompleted = false;
      user.profileSetupCompleted = false;
      user.starterKitClaimed = false;
    } else {
      user = await this.usersService.updateTelegramData(user.id, {
        username: telegramUser.username || user.username,
        firstName: telegramUser.first_name || user.firstName,
        lastName: telegramUser.last_name || user.lastName,
        avatarUrl: telegramUser.photo_url || user.avatarUrl,
      });
    }

    const payload = {
      sub: user.id,
      telegramId: user.telegramId,
      username: user.username,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async validateUser(payload: any) {
    return await this.usersService.findOne(payload.sub);
  }
}

