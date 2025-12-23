import { Injectable, BadRequestException, Inject, forwardRef, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skin } from './skin.entity';
import { UserSkin } from './user-skin.entity';
import { ProgressService } from '../progress/progress.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class SkinsService implements OnModuleInit {
  private readonly logger = new Logger(SkinsService.name);

  constructor(
    @InjectRepository(Skin)
    private skinsRepository: Repository<Skin>,
    @InjectRepository(UserSkin)
    private userSkinsRepository: Repository<UserSkin>,
    private usersService: UsersService,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
  ) {}

  // Инициализация дефолтных скинов при первом запуске
  async onModuleInit() {
    await this.initializeDefaultSkins();
  }

  async initializeDefaultSkins(): Promise<void> {
    try {
      // Проверяем, есть ли уже дефолтные скины
      const existingDefaultSkins = await this.skinsRepository.find({
        where: { isDefault: true },
      });

      const defaultSkinsData = [
        {
          name: 'Классическая доска',
          description: 'Классическая доска для нардов',
          type: 'board',
          theme: 'classic',
          isDefault: true,
          isPremium: false,
          weight: 1,
          price: null, // Бесплатный
          rarity: 'common',
          imageUrl: '/img/доска.jpg', // Превью для магазина
          boardTextureUrl: '/img/доска.jpg', // Текстура для игры
        },
        {
          name: 'Классические кубики',
          description: 'Классические кубики для нардов',
          type: 'dice',
          theme: 'classic',
          isDefault: true,
          isPremium: false,
          weight: 1,
          price: null, // Бесплатный
          rarity: 'common',
          imageUrl: '/skins/default-dice.svg', // Превью для магазина
          diceTextureUrl: '/skins/default-dice.svg', // Текстура для игры
        },
        {
          name: 'Классические шашки',
          description: 'Классические шашки для нардов',
          type: 'checkers',
          theme: 'classic',
          isDefault: true,
          isPremium: false,
          weight: 1,
          price: null, // Бесплатный
          rarity: 'common',
          imageUrl: '/skins/default-checkers.svg', // Превью для магазина
          whiteCheckersTextureUrl: '/skins/default-checkers-white.svg', // Текстура для игры
          blackCheckersTextureUrl: '/skins/default-checkers-black.svg', // Текстура для игры
          checkersTextureUrl: '/skins/default-checkers.svg', // Для обратной совместимости
        },
      ];

      if (existingDefaultSkins.length === 0) {
        // Создаем дефолтные скины
        for (const skinData of defaultSkinsData) {
          const skin = this.skinsRepository.create(skinData);
          await this.skinsRepository.save(skin);
          this.logger.log(`✅ Создан дефолтный скин: ${skinData.name} (${skinData.type})`);
        }
      } else {
        // Обновляем существующие дефолтные скины, если у них нет нужных полей
        for (const skinData of defaultSkinsData) {
          const existingSkin = existingDefaultSkins.find(s => s.type === skinData.type);
          if (existingSkin) {
            let needsUpdate = false;
            
            // Обновляем поля, если их нет
            if (!existingSkin.imageUrl && skinData.imageUrl) {
              existingSkin.imageUrl = skinData.imageUrl;
              needsUpdate = true;
            }
            if (skinData.type === 'board' && !existingSkin.boardTextureUrl) {
              existingSkin.boardTextureUrl = skinData.boardTextureUrl;
              needsUpdate = true;
            }
            if (skinData.type === 'dice' && !existingSkin.diceTextureUrl) {
              existingSkin.diceTextureUrl = skinData.diceTextureUrl;
              needsUpdate = true;
            }
            if (skinData.type === 'checkers') {
              if (!existingSkin.whiteCheckersTextureUrl) {
                existingSkin.whiteCheckersTextureUrl = skinData.whiteCheckersTextureUrl;
                needsUpdate = true;
              }
              if (!existingSkin.blackCheckersTextureUrl) {
                existingSkin.blackCheckersTextureUrl = skinData.blackCheckersTextureUrl;
                needsUpdate = true;
              }
            }
            
            if (needsUpdate) {
              await this.skinsRepository.save(existingSkin);
              this.logger.log(`✅ Обновлен дефолтный скин: ${skinData.name} (${skinData.type})`);
            }
          } else {
            // Если скина нет, создаем его
            const skin = this.skinsRepository.create(skinData);
            await this.skinsRepository.save(skin);
            this.logger.log(`✅ Создан дефолтный скин: ${skinData.name} (${skinData.type})`);
          }
        }
      }
    } catch (error) {
      this.logger.error('Ошибка при инициализации дефолтных скинов:', error);
    }
  }

  async getAllSkins(): Promise<Skin[]> {
    return this.skinsRepository.find({
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async getSkinBonuses(userId: string): Promise<{ xpBonusPercent: number; moneyBonusPercent: number }> {
    // Получаем выбранные скины пользователя
    const selectedSkins = await this.userSkinsRepository.find({
      where: { userId, isSelected: true },
      relations: ['skin'],
    });

    let totalXpBonus = 0;
    let totalMoneyBonus = 0;

    for (const userSkin of selectedSkins) {
      if (userSkin.skin) {
        // Проверяем, что скин не изношен
        const maxDurability = userSkin.skin.maxDurability || 100;
        const currentDurability = userSkin.currentDurability ?? maxDurability;
        
        if (currentDurability > 0) {
          totalXpBonus += userSkin.skin.xpBonusPercent || 0;
          totalMoneyBonus += userSkin.skin.moneyBonusPercent || 0;
        }
      }
    }

    // Также проверяем дефолтные скины, если они выбраны
    const allSkins = await this.skinsRepository.find({
      where: { isDefault: true },
    });

    // Если у пользователя нет выбранных скинов, используем дефолтные
    if (selectedSkins.length === 0) {
      for (const skin of allSkins) {
        totalXpBonus += skin.xpBonusPercent || 0;
        totalMoneyBonus += skin.moneyBonusPercent || 0;
      }
    }

    return {
      xpBonusPercent: totalXpBonus,
      moneyBonusPercent: totalMoneyBonus,
    };
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
   * Получает скины пользователя с информацией об износе
   */
  async getUserSkinsWithDurability(userId: string): Promise<any[]> {
    // Получаем все скины пользователя из user_skins
    const userSkins = await this.userSkinsRepository.find({
      where: { userId },
      relations: ['skin'],
    });
    
    // Получаем все default скины - они всегда доступны
    const defaultSkins = await this.skinsRepository.find({
      where: { isDefault: true },
    });
    
    // Создаем Map для быстрого доступа к информации об износе
    const durabilityMap = new Map<string, number>();
    for (const userSkin of userSkins) {
      if (userSkin.skin) {
        const maxDurability = userSkin.skin.maxDurability || 100;
        const currentDurability = userSkin.currentDurability ?? maxDurability;
        durabilityMap.set(userSkin.skin.id, currentDurability);
      }
    }
    
    // Создаем Set с ID default скинов для быстрой проверки
    const defaultSkinIds = new Set(defaultSkins.map(s => s.id));
    
    // Объединяем: default скины + скины пользователя (исключая дубликаты и default скины)
    const allSkins: any[] = defaultSkins.map(skin => ({
      ...skin,
      currentDurability: durabilityMap.get(skin.id) ?? (skin.maxDurability || 100),
    }));
    
    for (const userSkin of userSkins) {
      if (userSkin.skin && !defaultSkinIds.has(userSkin.skin.id)) {
        // Проверяем, что этот скин еще не добавлен в allSkins
        const alreadyAdded = allSkins.some(s => s.id === userSkin.skin.id);
        if (!alreadyAdded) {
          const maxDurability = userSkin.skin.maxDurability || 100;
          const currentDurability = userSkin.currentDurability ?? maxDurability;
          allSkins.push({
            ...userSkin.skin,
            currentDurability,
          });
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

  async decreaseSkinDurability(userId: string, skinId: string): Promise<void> {
    const userSkin = await this.userSkinsRepository.findOne({
      where: { userId, skinId },
      relations: ['skin'],
    });

    if (!userSkin || !userSkin.skin) {
      return;
    }

    const maxDurability = userSkin.skin.maxDurability || 100;
    const currentDurability = userSkin.currentDurability ?? maxDurability;

    if (currentDurability > 0) {
      userSkin.currentDurability = currentDurability - 1;
      await this.userSkinsRepository.save(userSkin);

      // Если износ достиг нуля, снимаем скины с выбора
      if (userSkin.currentDurability === 0 && userSkin.isSelected) {
        userSkin.isSelected = false;
        await this.userSkinsRepository.save(userSkin);
      }
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
      if (defaultBoard) {
        result.board = defaultBoard;
      }
    }
    if (!result.dice) {
      const defaultDice = allSkins.find(s => s.type === 'dice');
      if (defaultDice) {
        result.dice = defaultDice;
      }
    }
    if (!result.checkers) {
      const defaultCheckers = allSkins.find(s => s.type === 'checkers');
      if (defaultCheckers) {
        result.checkers = defaultCheckers;
      }
    }

    return result;
  }

  /**
   * Возвращает ТОЛЬКО явно выбранные скины (без fallback на дефолтные)
   * Используется для отображения статуса "Экипировано" в инвентаре
   */
  async getExplicitlySelectedSkins(userId: string): Promise<{ board?: Skin; dice?: Skin; checkers?: Skin }> {
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

    // БЕЗ FALLBACK - возвращаем только явно выбранные скины
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

    // Проверяем цену - если скин бесплатный, просто выдаем его
    const price = skin.price ? Number(skin.price) : 0;
    
    if (price > 0) {
      // Платный скин - проверяем баланс и списываем средства
      const user = await this.usersService.findOne(userId);
      const userBalance = Number(user.narCoin);

      if (userBalance < price) {
        throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${price}, у вас: ${userBalance}`);
      }

      // Списываем средства
      const newBalance = userBalance - price;
      await this.usersService.update(userId, { narCoin: newBalance });
    }
    // Если скин бесплатный (price === 0 или price === null), просто выдаем его без списания

    // Добавляем скин пользователю
    await this.addSkinToUser(userId, skinId);
  }

  /**
   * Вычисляет стоимость ремонта скина
   * @param userId ID пользователя
   * @param skinId ID скина
   * @returns Стоимость ремонта в NAR-coin
   */
  async calculateRepairCost(userId: string, skinId: string): Promise<number> {
    const userSkin = await this.userSkinsRepository.findOne({
      where: { userId, skinId },
      relations: ['skin'],
    });

    if (!userSkin || !userSkin.skin) {
      throw new BadRequestException('Скин не найден');
    }

    const skin = userSkin.skin;
    const maxDurability = skin.maxDurability || 100;
    const currentDurability = userSkin.currentDurability ?? maxDurability;
    const skinPrice = skin.price ? Number(skin.price) : 0;

    // Если скин бесплатный или полностью исправен, ремонт не требуется
    if (skinPrice === 0 || currentDurability >= maxDurability) {
      return 0;
    }

    // Вычисляем потерянную прочность
    const lostDurability = maxDurability - currentDurability;
    
    // Формула: 75% от цены скина * (потерянная прочность / максимальная прочность)
    const repairCost = Math.floor(skinPrice * 0.75 * (lostDurability / maxDurability));

    return repairCost;
  }

  /**
   * Ремонтирует скин пользователя
   * @param userId ID пользователя
   * @param skinId ID скина
   */
  async repairSkin(userId: string, skinId: string): Promise<void> {
    const userSkin = await this.userSkinsRepository.findOne({
      where: { userId, skinId },
      relations: ['skin'],
    });

    if (!userSkin || !userSkin.skin) {
      throw new BadRequestException('Скин не найден');
    }

    const skin = userSkin.skin;
    const maxDurability = skin.maxDurability || 100;
    const currentDurability = userSkin.currentDurability ?? maxDurability;

    // Если скин полностью исправен, ремонт не требуется
    if (currentDurability >= maxDurability) {
      throw new BadRequestException('Скин не требует ремонта');
    }

    // Вычисляем стоимость ремонта
    const repairCost = await this.calculateRepairCost(userId, skinId);

    if (repairCost > 0) {
      // Проверяем баланс пользователя
      const user = await this.usersService.findOne(userId);
      const userBalance = Number(user.narCoin);

      if (userBalance < repairCost) {
        throw new BadRequestException(`Недостаточно NAR-coin для ремонта. Требуется: ${repairCost}, у вас: ${userBalance}`);
      }

      // Списываем средства
      const newBalance = userBalance - repairCost;
      await this.usersService.update(userId, { narCoin: newBalance });
    }

    // Восстанавливаем прочность до максимума
    userSkin.currentDurability = maxDurability;
    await this.userSkinsRepository.save(userSkin);
  }
}

