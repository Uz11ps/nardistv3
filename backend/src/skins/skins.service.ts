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

  // Убрано: инициализация скинов теперь только через админку
  // Если нужно создать дефолтные скины, используйте админ-панель

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

  /**
   * Добавить скин пользователю (без автоматического выбора)
   */
  async addSkinToUser(userId: string, skinId: string): Promise<void> {
    const skin = await this.skinsRepository.findOne({ where: { id: skinId } });
    if (!skin) {
      throw new BadRequestException('Скин не найден');
    }

    // Проверяем, есть ли уже этот скин у пользователя
    const existingUserSkin = await this.userSkinsRepository.findOne({
      where: { userId, skinId },
    });

    if (!existingUserSkin) {
      const userSkin = this.userSkinsRepository.create({
        userId,
        skinId,
        isSelected: false,
      });
      await this.userSkinsRepository.save(userSkin);
    }
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

