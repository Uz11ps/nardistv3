import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ProgressService } from '../progress/progress.service';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const referralCode = this.generateReferralCode();
    const user = this.usersRepository.create({
      ...createUserDto,
      referralCode,
    });
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return user;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { telegramId } });
  }

  async findByReferralCode(referralCode: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { referralCode } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    let xpWasUpdated = false;
    
    // Конвертируем narCoin в bigint если он есть
    if (updateUserDto.narCoin !== undefined) {
      (user as any).narCoin = BigInt(updateUserDto.narCoin);
      delete (updateUserDto as any).narCoin;
    }
    
    // Конвертируем xp в bigint если он есть
    if ((updateUserDto as any).xp !== undefined && (updateUserDto as any).xp !== null) {
      const xpValue = (updateUserDto as any).xp;
      const oldXp = user.xp;
      
      if (typeof xpValue === 'bigint') {
        (user as any).xp = xpValue;
      } else {
        const xpNum = typeof xpValue === 'string' ? parseInt(xpValue, 10) : Number(xpValue);
        if (!isNaN(xpNum)) {
          (user as any).xp = BigInt(Math.max(0, xpNum));
        }
      }
      
      // Проверяем, действительно ли XP изменился
      if (oldXp !== user.xp) {
        xpWasUpdated = true;
      }
      delete (updateUserDto as any).xp;
    }
    
    // Конвертируем birthday в Date если он есть
    if (updateUserDto.birthday) {
      (user as any).birthday = new Date(updateUserDto.birthday);
      delete (updateUserDto as any).birthday;
    }
    
    Object.assign(user, updateUserDto);
    const savedUser = await this.usersRepository.save(user);
    
    // Если XP был обновлен, автоматически синхронизируем уровень
    if (xpWasUpdated) {
      try {
        await this.progressService.syncLevelFromXP(id);
        // Получаем обновленного пользователя с правильным уровнем
        return this.findOne(id);
      } catch (error) {
        // Логируем ошибку, но не прерываем выполнение
        console.error(`Ошибка синхронизации уровня для пользователя ${id}:`, error);
      }
    }
    
    return savedUser;
  }

  async updateProfile(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    
    // Проверяем уровень для РЕДАКТИРОВАНИЯ профиля (только если профиль уже создан)
    if (user.profileSetupCompleted) {
      if (updateUserDto.nickname !== undefined || updateUserDto.country !== undefined || updateUserDto.avatarUrl !== undefined) {
        const userLevel = user.level || 0;
        if (userLevel < 5) {
          throw new BadRequestException('Редактирование профиля доступно с 5 уровня');
        }
      }
    }
    
    // Конвертируем narCoin в bigint если он есть
    if (updateUserDto.narCoin !== undefined) {
      (user as any).narCoin = BigInt(updateUserDto.narCoin);
      delete (updateUserDto as any).narCoin;
    }
    
    // Конвертируем birthday в Date если он есть
    if (updateUserDto.birthday) {
      (user as any).birthday = new Date(updateUserDto.birthday);
      delete (updateUserDto as any).birthday;
    }
    
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async updateTelegramData(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, data);
    return this.usersRepository.save(user);
  }

  async banUser(id: string, reason: string): Promise<User> {
    const user = await this.findOne(id);
    user.isBanned = true;
    user.banReason = reason;
    return this.usersRepository.save(user);
  }

  async unbanUser(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isBanned = false;
    user.banReason = null;
    return this.usersRepository.save(user);
  }

  async getOnboardingProgress(userId: string): Promise<Record<string, boolean>> {
    const user = await this.findOne(userId);
    // Проверяем прогресс онбординга на основе игр пользователя
    // Здесь можно добавить логику проверки выполненных шагов
    return {
      bot_training: false, // Проверяется через историю игр с ботом
      first_online: false, // Проверяется через историю онлайн игр
      view_city: false, // Устанавливается вручную при просмотре города
    };
  }

  async completeOnboardingStep(userId: string, stepId: string): Promise<User> {
    const user = await this.findOne(userId);
    
    // Награждаем за выполнение шага
    const rewardNarCoin = 100;
    const rewardXP = 50;
    
    await this.progressService.addXP(userId, rewardXP);
    await this.progressService.addNarCoin(userId, rewardNarCoin);
    
    return user;
  }

  async getSettings(userId: string) {
    const user = await this.findOne(userId);
    return {
      vibration: user.vibration ?? true,
      sound: user.sound ?? true,
      matchNotifications: user.matchNotifications ?? true,
      economicEvents: user.economicEvents ?? true,
      clanEvents: user.clanEvents ?? true,
      language: user.languageCode === 'ru' ? 'Русский' : user.languageCode,
      timezone: user.timezone ?? 'Europe/Moscow',
    };
  }

  async updateSettings(userId: string, settings: {
    vibration?: boolean;
    sound?: boolean;
    matchNotifications?: boolean;
    economicEvents?: boolean;
    clanEvents?: boolean;
    language?: string;
  }) {
    const user = await this.findOne(userId);
    
    if (settings.vibration !== undefined) {
      user.vibration = settings.vibration;
    }
    if (settings.sound !== undefined) {
      user.sound = settings.sound;
    }
    if (settings.matchNotifications !== undefined) {
      user.matchNotifications = settings.matchNotifications;
    }
    if (settings.economicEvents !== undefined) {
      user.economicEvents = settings.economicEvents;
    }
    if (settings.clanEvents !== undefined) {
      user.clanEvents = settings.clanEvents;
    }
    if (settings.language !== undefined) {
      // Преобразуем русский язык в код
      user.languageCode = settings.language === 'Русский' ? 'ru' : settings.language;
    }
    if (settings.timezone !== undefined) {
      user.timezone = settings.timezone;
    }
    
    return this.usersRepository.save(user);
  }

  private generateReferralCode(): string {
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }
}

