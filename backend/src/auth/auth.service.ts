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
      console.error('❌ TELEGRAM_BOT_TOKEN не настроен в переменных окружения');
      throw new UnauthorizedException('TELEGRAM_BOT_TOKEN не настроен');
    }

    if (!initData || initData.trim() === '') {
      console.error('❌ initData пустой или отсутствует');
      throw new UnauthorizedException('Отсутствует initData');
    }

    console.log('🔐 Проверка initData, длина:', initData.length);
    console.log('🔐 Первые 100 символов:', initData.substring(0, 100));

    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      if (!hash) {
        console.error('❌ Отсутствует hash в initData');
        console.error('Параметры initData:', Array.from(urlParams.keys()));
        throw new UnauthorizedException('Отсутствует hash в initData');
      }
      urlParams.delete('hash');

      // Формируем строку для проверки из всех параметров кроме hash
      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      console.log('🔐 dataCheckString длина:', dataCheckString.length);
      console.log('🔐 dataCheckString первые 200 символов:', dataCheckString.substring(0, 200));

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

      console.log('🔐 Переданный hash:', hash);
      console.log('🔐 Вычисленный hash:', calculatedHash);

      // Сравниваем вычисленный hash с переданным
      if (calculatedHash !== hash) {
        console.error('❌ Hash не совпадает!');
        console.error('Переданный:', hash);
        console.error('Вычисленный:', calculatedHash);
        throw new UnauthorizedException('Неверная подпись Telegram initData');
      }

      // Извлекаем данные пользователя
      const userParam = urlParams.get('user');
      if (!userParam) {
        console.error('❌ Отсутствует параметр user в initData');
        throw new UnauthorizedException('Отсутствует параметр user в initData');
      }

      const userData = JSON.parse(userParam);
      const authDate = parseInt(urlParams.get('auth_date') || '0');
      const now = Math.floor(Date.now() / 1000);

      console.log('✅ Hash проверен успешно');
      console.log('👤 Данные пользователя:', { id: userData.id, username: userData.username });
      console.log('📅 auth_date:', authDate, 'текущее время:', now, 'разница:', now - authDate, 'секунд');

      // Проверяем что данные не устарели (не старше 24 часов)
      if (now - authDate > 86400) {
        console.error('❌ Данные авторизации устарели');
        throw new UnauthorizedException('Данные авторизации устарели');
      }

      return userData;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.error('❌ Ошибка при проверке initData:', error);
      throw new UnauthorizedException(`Ошибка проверки initData: ${error.message}`);
    }
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

  async guestLogin() {
    // Генерируем уникальный ID для гостя
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Создаем гостевого пользователя
    const createUserDto: CreateUserDto = {
      telegramId: guestId,
      username: `Гость_${Math.random().toString(36).substr(2, 6)}`,
      firstName: 'Гость',
      lastName: '',
      languageCode: 'ru',
      avatarUrl: '',
    };
    
    const user = await this.usersService.create(createUserDto);
    
    // Помечаем как гостя и пропускаем онбординг
    const updatedUser = await this.usersService.update(user.id, { 
      isGuest: true, 
      onboardingCompleted: true, 
      profileSetupCompleted: true, 
      starterKitClaimed: true 
    });

    const payload = {
      sub: updatedUser.id,
      telegramId: updatedUser.telegramId,
      username: updatedUser.username,
      isGuest: true,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: updatedUser,
    };
  }

  async validateUser(payload: any) {
    return await this.usersService.findOne(payload.sub);
  }
}

