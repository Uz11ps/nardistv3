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
    const secretKey = this.configService.get<string>('TELEGRAM_SECRET_KEY');
    if (!secretKey) {
      throw new Error('TELEGRAM_SECRET_KEY не настроен');
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKeyBuffer = crypto
      .createHmac('sha256', 'WebAppData')
      .update(secretKey)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKeyBuffer)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      throw new UnauthorizedException('Неверная подпись Telegram initData');
    }

    const userData = JSON.parse(urlParams.get('user') || '{}');
    const authDate = parseInt(urlParams.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);

    if (now - authDate > 86400) {
      throw new UnauthorizedException('Данные авторизации устарели');
    }

    return userData;
  }

  async login(initData: string) {
    const telegramUser = await this.verifyTelegramInitData(initData);
    
    let user = await this.usersService.findByTelegramId(telegramUser.id.toString());
    
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

