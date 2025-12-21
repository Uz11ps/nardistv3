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
    // Получаем все скины пользователя из user_skins
    const userSkins = await this.userSkinsRepository.find({
      where: { userId },
      relations: ['skin'],
    });
    
    // Получаем все default скины - они всегда доступны
    const defaultSkins = await this.skinsRepository.find({
      where: { isDefault: true },
    });
    
    // Создаем Set с ID default скинов для быстрой проверки
    const defaultSkinIds = new Set(defaultSkins.map(s => s.id));
    
    // Объединяем: default скины + скины пользователя (исключая дубликаты и default скины)
    const allSkins: Skin[] = [...defaultSkins];
    
    for (const userSkin of userSkins) {
      if (userSkin.skin && !defaultSkinIds.has(userSkin.skin.id)) {
        // Проверяем, что этот скин еще не добавлен в allSkins
        const alreadyAdded = allSkins.some(s => s.id === userSkin.skin.id);
        if (!alreadyAdded) {
          allSkins.push(userSkin.skin);
        }
      }
    }
    
    return allSkins;
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

    // Проверяем доступность скина: должен быть либо у пользователя, либо default
    if (!skin.isDefault) {
      const userHasSkin = await this.userSkinsRepository.findOne({
        where: { userId, skinId },
      });
      if (!userHasSkin) {
        throw new BadRequestException('Скин недоступен. Сначала приобретите его.');
      }
    }

    // Получаем все выбранные скины пользователя
    const selectedSkins = await this.userSkinsRepository.find({
      where: { userId, isSelected: true },
      relations: ['skin'],
    });

    // Вычисляем общий вес выбранных скинов (исключая скины того же типа, что и новый)
    const otherTypeSelectedSkins = selectedSkins.filter(us => us.skin && us.skin.type !== skin.type);
    const totalWeight = otherTypeSelectedSkins.reduce((sum, us) => sum + (us.skin?.weight || 1), 0) + (skin.weight || 1);

    // Проверяем лимит силы
    const canUse = await this.progressService.checkSkinWeightLimit(userId, totalWeight);
    if (!canUse) {
      const limit = await this.progressService.getSkinWeightLimit(userId);
      throw new BadRequestException(
        `Превышен лимит веса скинов. Лимит: ${limit}, текущий вес: ${totalWeight}`
      );
    }

    // Снимаем выбор с других скинов того же типа
    for (const userSkin of selectedSkins) {
      if (userSkin.skin && userSkin.skin.type === skin.type) {
        userSkin.isSelected = false;
        await this.userSkinsRepository.save(userSkin);
      }
    }

    // Проверяем или создаем запись user_skin (даже для default скинов)
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

  async getSelectedSkin(userId: string): Promise<{ board?: Skin; dice?: Skin; checkers?: Skin }> {
    const userSkins = await this.userSkinsRepository.find({
      where: { userId, isSelected: true },
      relations: ['skin'],
    });

    const result: { board?: Skin; dice?: Skin; checkers?: Skin } = {};
    
    for (const userSkin of userSkins) {
      if (userSkin.skin) {
        if (userSkin.skin.type === 'board' && !result.board) {
          result.board = userSkin.skin;
        } else if (userSkin.skin.type === 'dice' && !result.dice) {
          result.dice = userSkin.skin;
        } else if (userSkin.skin.type === 'checkers' && !result.checkers) {
          result.checkers = userSkin.skin;
        }
      }
    }

    // Если не выбран скин какого-то типа, используем default скин этого типа
    const allSkins = await this.skinsRepository.find({
      where: { isDefault: true },
    });
    
    if (!result.board) {
      const defaultBoard = allSkins.find(s => s.type === 'board');
      if (defaultBoard) result.board = defaultBoard;
    }
    if (!result.dice) {
      const defaultDice = allSkins.find(s => s.type === 'dice');
      if (defaultDice) result.dice = defaultDice;
    }
    if (!result.checkers) {
      const defaultCheckers = allSkins.find(s => s.type === 'checkers');
      if (defaultCheckers) result.checkers = defaultCheckers;
    }

    return result;
  }

  async purchaseSkin(userId: string, skinId: string): Promise<void> {
    const skin = await this.skinsRepository.findOne({ where: { id: skinId } });
    if (!skin) {
      throw new BadRequestException('Скин не найден');
    }

    // Проверяем, есть ли уже этот скин у пользователя
    const existingUserSkin = await this.userSkinsRepository.findOne({
      where: { userId, skinId },
    });

    if (existingUserSkin) {
      throw new BadRequestException('Скин уже куплен');
    }

    // Проверяем цену
    if (!skin.price || skin.price <= 0) {
      throw new BadRequestException('Скин бесплатный, покупка не требуется');
    }

    const user = await this.usersService.findOne(userId);
    const userBalance = Number(user.narCoin);
    const price = Number(skin.price);

    if (userBalance < price) {
      throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${price}, у вас: ${userBalance}`);
    }

    // Списываем средства
    const newBalance = userBalance - price;
    await this.usersService.update(userId, { narCoin: newBalance });

    // Добавляем скин пользователю
    await this.addSkinToUser(userId, skinId);
  }
}

