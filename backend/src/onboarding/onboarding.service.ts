import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ProgressService } from '../progress/progress.service';
import { SkinsService } from '../skins/skins.service';

@Injectable()
export class OnboardingService {
  constructor(
    private usersService: UsersService,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
    private skinsService: SkinsService,
  ) {}

  /**
   * Проверка статуса онбординга пользователя
   */
  async getOnboardingStatus(userId: string): Promise<{
    welcomeShown: boolean;
    profileSetupCompleted: boolean;
    starterKitClaimed: boolean;
    onboardingCompleted: boolean;
  }> {
    const user = await this.usersService.findOne(userId);
    return {
      welcomeShown: true, // Всегда true, так как пользователь уже авторизован
      profileSetupCompleted: user.profileSetupCompleted || false,
      starterKitClaimed: user.starterKitClaimed || false,
      onboardingCompleted: user.onboardingCompleted || false,
    };
  }

  /**
   * Сохранение данных профиля при онбординге
   */
  async completeProfileSetup(
    userId: string,
    profileData: {
      nickname?: string;
      country?: string;
      avatarUrl?: string;
    },
  ): Promise<void> {
    const user = await this.usersService.findOne(userId);
    
    const updateData: any = {
      profileSetupCompleted: true,
    };

    if (profileData.nickname) {
      updateData.nickname = profileData.nickname;
    }

    if (profileData.country) {
      updateData.country = profileData.country;
    }

    if (profileData.avatarUrl) {
      updateData.avatarUrl = profileData.avatarUrl;
    }

    await this.usersService.update(userId, updateData);
  }

  /**
   * Выдача стартового набора
   */
  async claimStarterKit(userId: string): Promise<{
    narCoin: number;
    starterKit: {
      board: { id: string; name: string };
      dice: { id: string; name: string };
    };
  }> {
    const user = await this.usersService.findOne(userId);

    if (user.starterKitClaimed) {
      throw new BadRequestException('Стартовый набор уже получен');
    }

    // Выдаем 1000 NAR-coin
    const starterCoinAmount = 1000;
    const currentBalance = Number(user.narCoin || 0);
    const newBalance = currentBalance + starterCoinAmount;
    await this.usersService.update(userId, { narCoin: newBalance });

    // Выдаем базовые скины (доска и кости) - ищем скины с isDefault = true
    const allSkins = await this.skinsService.getAllSkins();
    const defaultBoard = allSkins.find(s => s.type === 'board' && s.isDefault);
    const defaultDice = allSkins.find(s => s.type === 'dice' && s.isDefault);

    if (defaultBoard) {
      try {
        await this.skinsService.addSkinToUser(userId, defaultBoard.id);
      } catch (error) {
        // Игнорируем ошибку, если скин уже есть
        console.log('Default board skin already exists or error:', error);
      }
    }
    if (defaultDice) {
      try {
        await this.skinsService.addSkinToUser(userId, defaultDice.id);
      } catch (error) {
        // Игнорируем ошибку, если скин уже есть
        console.log('Default dice skin already exists or error:', error);
      }
    }

    // Отмечаем что набор получен
    await this.usersService.update(userId, { starterKitClaimed: true });

    // Если профиль заполнен и набор получен - онбординг завершен
    if (user.profileSetupCompleted) {
      await this.usersService.update(userId, { onboardingCompleted: true });
    }

    return {
      narCoin: starterCoinAmount,
      starterKit: {
        board: defaultBoard ? { id: defaultBoard.id, name: defaultBoard.name } : { id: '', name: 'Базовая доска' },
        dice: defaultDice ? { id: defaultDice.id, name: defaultDice.name } : { id: '', name: 'Базовые кости' },
      },
    };
  }

  /**
   * Завершение онбординга (вызывается после получения стартового набора)
   */
  async completeOnboarding(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    
    if (!user.profileSetupCompleted || !user.starterKitClaimed) {
      throw new BadRequestException('Сначала завершите настройку профиля и получите стартовый набор');
    }

    await this.usersService.update(userId, { onboardingCompleted: true });
  }
}

