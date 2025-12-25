import { Injectable, BadRequestException, Inject, forwardRef, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skin } from './skin.entity';
import { UserSkin } from './user-skin.entity';
import { ProgressService } from '../progress/progress.service';
import { UsersService } from '../users/users.service';
import {
  getDurabilityMax,
  getWearModeBySlot,
  calculateRepairCost as calculateRepairCostUtil,
  applyWear,
  typeToSlot,
} from './equipment-spec.utils';
import { BonusType, EQUIPMENT_CAPS } from './equipment-spec.constants';
import { BonusType as BonusTypeEnum } from './equipment-spec.constants';

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
          slot: 'BOARD',
          theme: 'classic',
          isDefault: true,
          isPremium: false,
          is_premium_shop: false,
          weight: 1,
          price: null, // Бесплатный
          rarity: 'COMMON',
          required_level: 1,
          required_power_sp: null,
          wear_mode: 'PER_MATCH',
          wear_amount: 1,
          tournament_wear_mult: 2.0,
          durability_max: getDurabilityMax('COMMON', 'PER_MATCH'), // 100
          repair_currency: 'NAR',
          repair_base_cost: 0, // Бесплатный ремонт для дефолтного скина
          bonuses: null,
          imageUrl: '/img/доска.jpg',
          boardTextureUrl: '/img/доска.jpg',
        },
        {
          name: 'Классические кубики',
          description: 'Классические кубики для нардов',
          type: 'dice',
          slot: 'DIE_1', // Первый кубик
          theme: 'classic',
          isDefault: true,
          isPremium: false,
          is_premium_shop: false,
          weight: 1,
          price: null,
          rarity: 'COMMON',
          required_level: 1,
          required_power_sp: null,
          wear_mode: 'PER_ROLL',
          wear_amount: 1,
          tournament_wear_mult: 2.0,
          durability_max: getDurabilityMax('COMMON', 'PER_ROLL'), // 1800
          repair_currency: 'NAR',
          repair_base_cost: 0,
          bonuses: null,
          imageUrl: '/skins/default-dice.svg',
          diceTextureUrl: '/skins/default-dice.svg',
        },
        {
          name: 'Классические шашки',
          description: 'Классические шашки для нардов',
          type: 'checkers',
          slot: 'CHECKERS',
          theme: 'classic',
          isDefault: true,
          isPremium: false,
          is_premium_shop: false,
          weight: 1,
          price: null,
          rarity: 'COMMON',
          required_level: 1,
          required_power_sp: null,
          wear_mode: 'PER_MATCH',
          wear_amount: 1,
          tournament_wear_mult: 2.0,
          durability_max: getDurabilityMax('COMMON', 'PER_MATCH'), // 100
          repair_currency: 'NAR',
          repair_base_cost: 0,
          bonuses: null,
          imageUrl: '/skins/default-checkers.svg',
          whiteCheckersTextureUrl: '/skins/default-checkers-white.svg',
          blackCheckersTextureUrl: '/skins/default-checkers-black.svg',
          checkersTextureUrl: '/skins/default-checkers.svg',
        },
      ];

      if (existingDefaultSkins.length === 0) {
        // Создаем дефолтные скины
        for (const skinData of defaultSkinsData) {
          // Убеждаемся, что durability_max установлен
          if (!skinData.durability_max) {
            const slot = skinData.slot || typeToSlot(skinData.type);
            const wearMode = getWearModeBySlot(slot);
            skinData.durability_max = getDurabilityMax(skinData.rarity || 'COMMON', wearMode);
          }
          
          const skin = this.skinsRepository.create(skinData);
          await this.skinsRepository.save(skin);
          this.logger.log(`✅ Создан дефолтный скин: ${skinData.name} (${skinData.slot || skinData.type}), durability_max=${skinData.durability_max}`);
        }
      } else {
        // Обновляем существующие дефолтные скины
        for (const skinData of defaultSkinsData) {
          const existingSkin = existingDefaultSkins.find(s => s.type === skinData.type);
          if (existingSkin) {
            let needsUpdate = false;
            
            // Для дефолтной доски всегда обновляем на новую текстуру
            if (skinData.type === 'board') {
              if (existingSkin.boardTextureUrl !== skinData.boardTextureUrl) {
                existingSkin.boardTextureUrl = skinData.boardTextureUrl;
                needsUpdate = true;
              }
              if (existingSkin.imageUrl !== skinData.imageUrl) {
                existingSkin.imageUrl = skinData.imageUrl;
                needsUpdate = true;
              }
            } else {
              // Для других скинов обновляем только если поля отсутствуют
              if (!existingSkin.imageUrl && skinData.imageUrl) {
                existingSkin.imageUrl = skinData.imageUrl;
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
            }
            
            // Обновляем поля Equipment Spec, если они отсутствуют
            if (!existingSkin.slot && skinData.slot) {
              existingSkin.slot = skinData.slot;
              needsUpdate = true;
            }
            if (!existingSkin.durability_max && skinData.durability_max) {
              existingSkin.durability_max = skinData.durability_max;
              needsUpdate = true;
            }
            if (!existingSkin.wear_mode && skinData.wear_mode) {
              existingSkin.wear_mode = skinData.wear_mode;
              needsUpdate = true;
            }
            if (existingSkin.rarity && existingSkin.rarity.toLowerCase() === 'common' && !existingSkin.rarity.startsWith('COMMON')) {
              existingSkin.rarity = 'COMMON';
              needsUpdate = true;
            }
            
            if (needsUpdate) {
              await this.skinsRepository.save(existingSkin);
              this.logger.log(`✅ Обновлен дефолтный скин: ${skinData.name} (${skinData.slot || skinData.type})`);
            }
          } else {
            // Если скина нет, создаем его
            // Убеждаемся, что durability_max установлен
            if (!skinData.durability_max) {
              const slot = skinData.slot || typeToSlot(skinData.type);
              const wearMode = getWearModeBySlot(slot);
              skinData.durability_max = getDurabilityMax(skinData.rarity || 'COMMON', wearMode);
            }
            
            const skin = this.skinsRepository.create(skinData);
            await this.skinsRepository.save(skin);
            this.logger.log(`✅ Создан дефолтный скин: ${skinData.name} (${skinData.slot || skinData.type}), durability_max=${skinData.durability_max}`);
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

  async updateDefaultSkins(): Promise<void> {
    // Принудительно обновляем дефолтные скины
    await this.initializeDefaultSkins();
  }

  /**
   * Получает бонусы от экипировки пользователя (новая система Equipment Spec v2.0 + обратная совместимость)
   */
  async getSkinBonuses(userId: string): Promise<{ xpBonusPercent: number; moneyBonusPercent: number; bonuses?: any }> {
    const selectedSkins = await this.userSkinsRepository.find({
      where: { userId, isSelected: true },
      relations: ['skin'],
    });

    // Новая система бонусов (Equipment Spec v2.0)
    const bonuses: any = {
      xpMult: 1.0,
      commissionReduction: 0,
      energyRefillDiscount: 0,
      lifeRefillDiscount: 0,
      wearReduction: 0,
      repairDiscount: 0,
      lifeLossProtectChance: 0,
    };

    // Старая система (для обратной совместимости)
    let totalXpBonus = 0;
    let totalMoneyBonus = 0;

    for (const userSkin of selectedSkins) {
      if (userSkin.skin) {
        const durabilityMax = userSkin.skin.durability_max || userSkin.skin.maxDurability || 100;
        const durabilityCurrent = userSkin.durability_current ?? userSkin.currentDurability ?? durabilityMax;
        
        if (durabilityCurrent > 0) {
          // Новая система бонусов (массив bonuses)
          if (userSkin.skin.bonuses && Array.isArray(userSkin.skin.bonuses)) {
            for (const bonus of userSkin.skin.bonuses) {
              switch (bonus.type) {
                case BonusType.XP_MULT:
                  bonuses.xpMult *= bonus.value || 1.0;
                  break;
                case BonusType.COMMISSION_REDUCTION:
                  bonuses.commissionReduction += bonus.value || 0;
                  break;
                case BonusType.ENERGY_REFILL_DISCOUNT:
                  bonuses.energyRefillDiscount += bonus.value || 0;
                  break;
                case BonusType.LIFE_REFILL_DISCOUNT:
                  bonuses.lifeRefillDiscount += bonus.value || 0;
                  break;
                case BonusType.WEAR_REDUCTION:
                  bonuses.wearReduction += bonus.value || 0;
                  break;
                case BonusType.REPAIR_DISCOUNT:
                  bonuses.repairDiscount += bonus.value || 0;
                  break;
                case BonusType.LIFE_LOSS_PROTECT_CHANCE:
                  bonuses.lifeLossProtectChance += bonus.value || 0;
                  break;
              }
            }
          }

          // Старая система (обратная совместимость)
          totalXpBonus += userSkin.skin.xpBonusPercent || 0;
          totalMoneyBonus += userSkin.skin.moneyBonusPercent || 0;
        }
      }
    }

    // Применяем потолки (caps)
    bonuses.xpMult = Math.min(bonuses.xpMult, EQUIPMENT_CAPS.XP_MULT.GEAR_CAP);
    bonuses.lifeLossProtectChance = Math.min(bonuses.lifeLossProtectChance, EQUIPMENT_CAPS.LIFE_LOSS_PROTECT.MAX);
    bonuses.commissionReduction = Math.min(bonuses.commissionReduction, EQUIPMENT_CAPS.COMMISSION.BASE - EQUIPMENT_CAPS.COMMISSION.MIN_FINAL);

    // Дефолтные скины (если нет выбранных)
    if (selectedSkins.length === 0) {
      const allSkins = await this.skinsRepository.find({
        where: { isDefault: true },
      });

      for (const skin of allSkins) {
        totalXpBonus += skin.xpBonusPercent || 0;
        totalMoneyBonus += skin.moneyBonusPercent || 0;
      }
    }

    return {
      xpBonusPercent: totalXpBonus,
      moneyBonusPercent: totalMoneyBonus,
      bonuses, // Новые бонусы
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
      // Определяем максимальную прочность для нового предмета (Equipment Spec v2.0)
      const durabilityMax = skin.durability_max || getDurabilityMax(
        skin.rarity || 'COMMON',
        skin.wear_mode || getWearModeBySlot(skin.slot || typeToSlot(skin.type || 'board')),
      );

      const userSkin = this.userSkinsRepository.create({
        userId,
        skinId,
        isSelected: false,
        durability_current: durabilityMax, // Инициализируем максимальной прочностью
        currentDurability: durabilityMax, // Для обратной совместимости
      });
      await this.userSkinsRepository.save(userSkin);
    }
  }

  /**
   * УСТАРЕЛО: Используйте applyWearToEquipment
   * Применяет износ к предмету после матча (Equipment Spec v2.0)
   */
  async decreaseSkinDurability(userId: string, skinId: string, isTournament: boolean = false): Promise<void> {
    const userSkin = await this.userSkinsRepository.findOne({
      where: { userId, skinId },
      relations: ['skin'],
    });

    if (!userSkin || !userSkin.skin) {
      return;
    }

    const skin = userSkin.skin;
    const durabilityMax = skin.durability_max || skin.maxDurability || 100;
    const durabilityCurrent = userSkin.durability_current ?? userSkin.currentDurability ?? durabilityMax;

    // Используем новую систему износа или старую для совместимости
    const wearMode = skin.wear_mode || 'PER_MATCH';
    const wearAmount = skin.wear_amount || 1;
    const tournamentWearMult = skin.tournament_wear_mult || 2.0;

    if (durabilityCurrent > 0) {
      // Применяем износ по новой системе
      const newDurability = applyWear(
        durabilityCurrent,
        durabilityMax,
        wearAmount,
        isTournament,
        tournamentWearMult,
      );

      userSkin.durability_current = newDurability;
      userSkin.currentDurability = newDurability; // Для обратной совместимости
      await this.userSkinsRepository.save(userSkin);

      // Если предмет уничтожен (durability <= 0), снимаем с выбора
      if (newDurability <= 0 && userSkin.isSelected) {
        userSkin.isSelected = false;
        await this.userSkinsRepository.save(userSkin);
        this.logger.warn(`⚠️ Предмет ${skinId} уничтожен из-за износа у пользователя ${userId}`);
      }
    }
  }

  /**
   * Применяет износ к экипировке после матча (Equipment Spec v2.0)
   * @param userId ID пользователя
   * @param slot Слот экипировки (BOARD, CHECKERS, CUP, CLOCK, CASE) или null для всех PER_MATCH предметов
   * @param isTournament Является ли это турниром
   */
  async applyWearToEquipmentAfterMatch(userId: string, slot: string | null = null, isTournament: boolean = false): Promise<void> {
    const selectedSkins = await this.userSkinsRepository.find({
      where: { userId, isSelected: true },
      relations: ['skin'],
    });

    for (const userSkin of selectedSkins) {
      if (!userSkin.skin) continue;

      const skin = userSkin.skin;
      const equipmentSlot = skin.slot || typeToSlot(skin.type || 'board');
      
      // Применяем износ только к PER_MATCH предметам
      const wearMode = skin.wear_mode || 'PER_MATCH';
      if (wearMode !== 'PER_MATCH') continue;

      // Если указан конкретный слот, применяем только к нему
      if (slot && equipmentSlot !== slot) continue;

      await this.decreaseSkinDurability(userId, skin.id, isTournament);
    }
  }

  /**
   * Применяет износ к кубику после броска (Equipment Spec v2.0)
   * @param userId ID пользователя
   * @param dieSlot Слот кубика (DIE_1 или DIE_2)
   */
  async applyWearToDieAfterRoll(userId: string, dieSlot: 'DIE_1' | 'DIE_2'): Promise<void> {
    const selectedSkins = await this.userSkinsRepository.find({
      where: { userId, isSelected: true },
      relations: ['skin'],
    });

    for (const userSkin of selectedSkins) {
      if (!userSkin.skin) continue;

      const skin = userSkin.skin;
      const equipmentSlot = skin.slot || typeToSlot(skin.type || 'board');
      
      // Применяем износ только к указанному кубику с PER_ROLL режимом
      if (equipmentSlot !== dieSlot) continue;

      const wearMode = skin.wear_mode || 'PER_ROLL';
      if (wearMode !== 'PER_ROLL') continue;

      const durabilityMax = skin.durability_max || getDurabilityMax(skin.rarity || 'COMMON', 'PER_ROLL');
      const durabilityCurrent = userSkin.durability_current ?? userSkin.currentDurability ?? durabilityMax;
      const wearAmount = skin.wear_amount || 1;

      if (durabilityCurrent > 0) {
        const newDurability = applyWear(durabilityCurrent, durabilityMax, wearAmount, false, 1.0);

        userSkin.durability_current = newDurability;
        userSkin.currentDurability = newDurability;
        await this.userSkinsRepository.save(userSkin);

        // Если предмет уничтожен, снимаем с выбора
        if (newDurability <= 0 && userSkin.isSelected) {
          userSkin.isSelected = false;
          await this.userSkinsRepository.save(userSkin);
          this.logger.warn(`⚠️ Кубик ${dieSlot} уничтожен из-за износа у пользователя ${userId}`);
        }
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
  /**
   * Вычисляет стоимость ремонта скина по формуле Equipment Spec v2.0
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
    const user = await this.usersService.findOne(userId);

    // Используем новую систему или старую для обратной совместимости
    const durabilityMax = skin.durability_max || skin.maxDurability || 100;
    const durabilityCurrent = userSkin.durability_current ?? userSkin.currentDurability ?? durabilityMax;
    const repairBaseCost = skin.repair_base_cost || (skin.price ? Number(skin.price) * 0.75 : 0);

    // Если скин полностью исправен или нет базовой стоимости, ремонт не требуется
    if (repairBaseCost === 0 || durabilityCurrent >= durabilityMax) {
      return 0;
    }

    // Используем новую формулу из спецификации
    return calculateRepairCostUtil(
      durabilityMax,
      durabilityCurrent,
      repairBaseCost,
      user.level || 1,
    );
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
    const durabilityMax = skin.durability_max || skin.maxDurability || 100;
    const durabilityCurrent = userSkin.durability_current ?? userSkin.currentDurability ?? durabilityMax;

    // Проверяем, что предмет не уничтожен (durability_current > 0)
    if (durabilityCurrent <= 0) {
      throw new BadRequestException('Предмет уничтожен, ремонт невозможен');
    }

    // Если скин полностью исправен, ремонт не требуется
    if (durabilityCurrent >= durabilityMax) {
      throw new BadRequestException('Скин не требует ремонта');
    }

    // Вычисляем стоимость ремонта
    const repairCost = await this.calculateRepairCost(userId, skinId);

    if (repairCost > 0) {
      const user = await this.usersService.findOne(userId);
      const repairCurrency = skin.repair_currency || 'NAR';

      if (repairCurrency === 'USDT') {
        // TODO: Реализовать списание USDT
        throw new BadRequestException('Ремонт за USDT пока не реализован');
      } else {
        // Ремонт за NAR
        const userBalance = Number(user.narCoin);

        if (userBalance < repairCost) {
          throw new BadRequestException(`Недостаточно NAR-coin для ремонта. Требуется: ${repairCost}, у вас: ${userBalance}`);
        }

        const newBalance = userBalance - repairCost;
        await this.usersService.update(userId, { narCoin: newBalance });
      }
    }

    // Восстанавливаем прочность до максимума
    userSkin.durability_current = durabilityMax;
    userSkin.currentDurability = durabilityMax; // Для обратной совместимости
    await this.userSkinsRepository.save(userSkin);
  }
}

