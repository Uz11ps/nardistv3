import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skin } from './skin.entity';
import { UserSkin } from './user-skin.entity';
import { ProgressService } from '../progress/progress.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class SkinsService {
  constructor(
    @InjectRepository(Skin)
    private skinsRepository: Repository<Skin>,
    @InjectRepository(UserSkin)
    private userSkinsRepository: Repository<UserSkin>,
    private usersService: UsersService,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
  ) {}

  async initializeDefaultSkins(): Promise<void> {
    const defaultSkins = [
      {
        name: 'Классический',
        theme: 'classic',
        boardConfig: { color: '#D2691E' },
        diceConfig: { color: '#FFFFFF' },
        isDefault: true,
        weight: 1,
      },
      {
        name: 'Темный',
        theme: 'dark',
        boardConfig: { color: '#2C2C2C' },
        diceConfig: { color: '#FFFFFF' },
        isDefault: true,
        weight: 1,
      },
      {
        name: 'Морской',
        theme: 'ocean',
        boardConfig: { color: '#1E90FF' },
        diceConfig: { color: '#FFFFFF' },
        isDefault: true,
        weight: 2,
      },
      {
        name: 'Лесной',
        theme: 'forest',
        boardConfig: { color: '#228B22' },
        diceConfig: { color: '#FFFFFF' },
        isDefault: true,
        weight: 2,
      },
    ];

    for (const skinData of defaultSkins) {
      const existing = await this.skinsRepository.findOne({
        where: { theme: skinData.theme },
      });
      if (!existing) {
        await this.skinsRepository.save(this.skinsRepository.create(skinData));
      }
    }
  }

  async getAllSkins(): Promise<Skin[]> {
    return this.skinsRepository.find();
  }

  async getUserSkins(userId: string): Promise<Skin[]> {
    const userSkins = await this.userSkinsRepository.find({
      where: { userId },
      relations: ['skin'],
    });
    return userSkins.map((us) => us.skin);
  }

  async selectSkin(userId: string, skinId: string): Promise<void> {
    const skin = await this.skinsRepository.findOne({ where: { id: skinId } });
    if (!skin) {
      throw new BadRequestException('Скин не найден');
    }

    // Получаем все выбранные скины пользователя
    const selectedSkins = await this.userSkinsRepository.find({
      where: { userId, isSelected: true },
      relations: ['skin'],
    });

    // Вычисляем общий вес выбранных скинов + новый скин
    const totalWeight = selectedSkins.reduce((sum, us) => sum + (us.skin?.weight || 1), 0) + (skin.weight || 1);

    // Проверяем лимит силы
    const canUse = await this.progressService.checkSkinWeightLimit(userId, totalWeight);
    if (!canUse) {
      const limit = await this.progressService.getSkinWeightLimit(userId);
      throw new BadRequestException(
        `Превышен лимит веса скинов. Лимит: ${limit}, текущий вес: ${totalWeight}`
      );
    }

    await this.userSkinsRepository.update(
      { userId },
      { isSelected: false },
    );

    let userSkin = await this.userSkinsRepository.findOne({
      where: { userId, skinId },
    });

    if (!userSkin) {
      userSkin = this.userSkinsRepository.create({
        userId,
        skinId,
        isSelected: true,
      });
    } else {
      userSkin.isSelected = true;
    }

    await this.userSkinsRepository.save(userSkin);
  }

  async getSelectedSkin(userId: string): Promise<Skin | null> {
    const userSkin = await this.userSkinsRepository.findOne({
      where: { userId, isSelected: true },
      relations: ['skin'],
    });
    return userSkin ? userSkin.skin : null;
  }
}

