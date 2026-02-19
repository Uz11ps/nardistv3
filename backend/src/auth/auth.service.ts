import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { BirthdayService } from '../users/birthday.service';
import { ReferralsService } from '../referrals/referrals.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private configService: ConfigService,
    @Inject(forwardRef(() => BirthdayService))
    private birthdayService: BirthdayService,
    @Inject(forwardRef(() => ReferralsService))
    private referralsService: ReferralsService,
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
      
      // Извлекаем реферальный код из start_param (если пользователь открыл через ссылку бота)
      const startParam = urlParams.get('start_param');
      if (startParam) {
        userData.start_param = startParam;
      }

      console.log('✅ Hash проверен успешно');
      console.log('👤 Данные пользователя:', { id: userData.id, username: userData.username });
      console.log('📅 auth_date:', authDate, 'текущее время:', now, 'разница:', now - authDate, 'секунд');
      if (startParam) {
        console.log('🔗 Реферальный код из start_param:', startParam);
      }

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
    
    // Извлекаем реферальный код из start_param (если пользователь открыл через ссылку бота)
    const referralCode = (telegramUser as any).start_param;
    
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
      
      // Если есть реферальный код, применяем его
      if (referralCode && !user.referredBy) {
        try {
          await this.referralsService.useReferralCode(user.id, referralCode);
        } catch (error) {
          console.error('Ошибка при применении реферального кода:', error);
          // Не прерываем процесс логина, если реферальный код неверный
        }
      }
    } else {
      user = await this.usersService.updateTelegramData(user.id, {
        username: telegramUser.username || user.username,
        firstName: telegramUser.first_name || user.firstName,
        lastName: telegramUser.last_name || user.lastName,
        avatarUrl: telegramUser.photo_url || user.avatarUrl,
        lastLogin: new Date(), // Обновляем время последнего входа
      });
      
      // Проверяем день рождения при логине
      try {
        await this.birthdayService.checkUserBirthday(user.id);
      } catch (error) {
        console.error('Ошибка при проверке дня рождения:', error);
      }
    }

    // Проверяем, забанен ли пользователь
    if (user.isBanned) {
      const reason = user.banReason || 'Нарушение правил';
      throw new UnauthorizedException(`Вы были забанены по причине: ${reason}`);
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
    try {
      // Генерируем уникальный ID для гостя
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('👤 Создание гостевого пользователя:', { guestId });
      
      // Проверяем, не существует ли уже пользователь с таким telegramId (на случай коллизии)
      let existingUser = await this.usersService.findByTelegramId(guestId);
      if (existingUser) {
        console.log('⚠️ Пользователь с таким telegramId уже существует, используем существующего:', { userId: existingUser.id });
        // Если пользователь уже существует и это гость, используем его
        if (existingUser.isGuest) {
          const payload = {
            sub: existingUser.id,
            telegramId: existingUser.telegramId,
            username: existingUser.username,
            isGuest: true,
          };
          const token = this.jwtService.sign(payload);
          return {
            access_token: token,
            user: existingUser,
          };
        }
        // Если это не гость, генерируем новый ID
        const newGuestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        existingUser = await this.usersService.findByTelegramId(newGuestId);
        if (existingUser && existingUser.isGuest) {
          const payload = {
            sub: existingUser.id,
            telegramId: existingUser.telegramId,
            username: existingUser.username,
            isGuest: true,
          };
          const token = this.jwtService.sign(payload);
          return {
            access_token: token,
            user: existingUser,
          };
        }
      }
      
      // Создаем гостевого пользователя
      const createUserDto: CreateUserDto = {
        telegramId: guestId,
        username: `Гость_${Math.random().toString(36).substr(2, 6)}`,
        firstName: 'Гость',
        lastName: '',
        languageCode: 'ru',
        avatarUrl: '',
      };
      
      let user: any;
      try {
        user = await this.usersService.create(createUserDto);
        console.log('✅ Гостевой пользователь создан:', { userId: user.id, telegramId: user.telegramId });
      } catch (createError: any) {
        // Если ошибка уникальности telegramId, пробуем найти существующего гостя
        if (createError.code === '23505' || createError.message?.includes('unique') || createError.message?.includes('duplicate')) {
          console.log('⚠️ Коллизия telegramId, ищем существующего гостя');
          existingUser = await this.usersService.findByTelegramId(guestId);
          if (existingUser && existingUser.isGuest) {
            const payload = {
              sub: existingUser.id,
              telegramId: existingUser.telegramId,
              username: existingUser.username,
              isGuest: true,
            };
            const token = this.jwtService.sign(payload);
            return {
              access_token: token,
              user: existingUser,
            };
          }
        }
        throw createError;
      }
      
      // Помечаем как гостя и пропускаем онбординг
      const updatedUser = await this.usersService.update(user.id, { 
        isGuest: true, 
        onboardingCompleted: true, 
        profileSetupCompleted: true, 
        starterKitClaimed: true 
      });
      
      console.log('✅ Гостевой пользователь обновлен:', { userId: updatedUser.id, isGuest: updatedUser.isGuest });

      // Проверяем, что пользователь действительно сохранен в БД
      const verifyUser = await this.usersService.findOne(updatedUser.id);
      if (!verifyUser) {
        throw new Error('Пользователь не найден после создания');
      }
      console.log('✅ Пользователь подтвержден в БД:', { userId: verifyUser.id, isGuest: verifyUser.isGuest });

      const payload = {
        sub: verifyUser.id,
        telegramId: verifyUser.telegramId,
        username: verifyUser.username,
        isGuest: true,
      };

      const token = this.jwtService.sign(payload);
      console.log('✅ Токен создан для гостя:', { userId: verifyUser.id, tokenLength: token.length, payloadSub: payload.sub });

      return {
        access_token: token,
        user: verifyUser,
      };
    } catch (error) {
      console.error('❌ Ошибка при создании гостевого пользователя:', error);
      console.error('❌ Stack trace:', error.stack);
      throw error;
    }
  }

  async validateUser(payload: any) {
    try {
      if (!payload.sub) {
        console.error('❌ Валидация пользователя: payload.sub отсутствует');
        return null;
      }
      
      let user;
      try {
        user = await this.usersService.findOne(payload.sub);
      } catch (findError: any) {
        console.error('❌ Ошибка при поиске пользователя по sub:', findError);
        // Если пользователь не найден по sub, но это гость, попробуем найти по telegramId
        if (payload.telegramId && payload.telegramId.startsWith('guest_')) {
          try {
            const userByTelegramId = await this.usersService.findByTelegramId(payload.telegramId);
            if (userByTelegramId) {
              console.log('✅ Пользователь найден по telegramId при валидации:', { userId: userByTelegramId.id });
              return userByTelegramId;
            }
          } catch (findByTelegramIdError) {
            console.error('❌ Ошибка при поиске пользователя по telegramId:', findByTelegramIdError);
          }
        }
        return null;
      }
      
      if (!user) {
        console.error('❌ Пользователь не найден при валидации (user is null):', payload.sub);
        return null;
      }
      
      // Проверяем, забанен ли пользователь
      if (user.isBanned) {
        const reason = user.banReason || 'Нарушение правил';
        throw new UnauthorizedException(`Вы были забанены по причине: ${reason}`);
      }
      
      return user;
    } catch (error) {
      console.error('❌ Критическая ошибка при валидации пользователя:', error);
      console.error('❌ Stack trace:', error.stack);
      return null;
    }
  }
}

