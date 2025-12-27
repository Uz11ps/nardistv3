import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Building } from './building.entity';
import { BuildingConfig } from './building-config.entity';
import { DistrictConfig } from './district-config.entity';
import { DistrictCapture } from './district-capture.entity';
import { District } from '../clans/clan.entity';
import { UsersService } from '../users/users.service';
import { ClansService } from '../clans/clans.service';
import { Clan } from '../clans/clan.entity';
import { User } from '../users/user.entity';
import { ProgressionBranchesService } from '../progress/progression-branches.service';

@Injectable()
export class CityService {
  constructor(
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
    @InjectRepository(BuildingConfig)
    private buildingConfigsRepository: Repository<BuildingConfig>,
    @InjectRepository(DistrictConfig)
    private districtConfigsRepository: Repository<DistrictConfig>,
    @InjectRepository(DistrictCapture)
    private districtCapturesRepository: Repository<DistrictCapture>,
    @InjectRepository(Clan)
    private clansRepository: Repository<Clan>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private usersService: UsersService,
    @Inject(forwardRef(() => ClansService))
    private clansService: ClansService,
    @Inject(forwardRef(() => ProgressionBranchesService))
    private branchesService: ProgressionBranchesService,
  ) {}

  /**
   * Получить полную структуру города (районы и строения)
   */
  async getCityData(userId: string) {
    const districts = await this.districtConfigsRepository.find({
      where: { isActive: true },
      order: { order: 'ASC' },
    });

    const buildingConfigs = await this.buildingConfigsRepository.find();
    const userBuildings = await this.buildingsRepository.find({
      where: { userId },
    });

    const user = await this.usersService.findOne(userId);

    return districts.map(district => {
      const buildingsInDistrict = buildingConfigs.filter(bc => bc.districtId === district.id);
      
      const districtBuildings = buildingsInDistrict.map(config => {
        const userBuilding = userBuildings.find(ub => ub.type === config.type);
        
        return {
          config: {
            id: config.id,
            type: config.type,
            name: config.name,
            icon: config.icon,
            image: config.image,
            basePrice: Number(config.basePrice),
            baseIncomePerHour: Number(config.baseIncomePerHour),
            maxAccumulation: Number(config.maxAccumulation),
            maxLevel: config.maxLevel,
            upgradeMultiplier: config.upgradeMultiplier || 1.4,
          },
          userBuilding: userBuilding ? {
            id: userBuilding.id,
            level: userBuilding.level,
            accumulatedIncome: Number(userBuilding.accumulatedIncome),
            incomePerHour: Number(userBuilding.incomePerHour),
            lastIncomeCollection: userBuilding.lastIncomeCollection,
          } : null,
        };
      });

      // Логика разблокировки: user.level >= district.requiredLevel
      // requiredLevel всегда загружается из админки
      const userLevel = user.level || 1;
      const requiredLevel = district.requiredLevel ?? 1; // По умолчанию 1, если не указан
      const isUnlocked = userLevel >= requiredLevel;

      return {
        id: district.id,
        code: district.code,
        name: district.name,
        description: district.description,
        icon: district.icon,
        image: district.image,
        requiredLevel: requiredLevel, // Всегда возвращаем requiredLevel из админки
        isUnlocked: isUnlocked,
        buildings: districtBuildings,
      };
    });
  }

  /**
   * Получить все доступные конфигурации строений
   */
  async getAvailableBuildings(userId?: string) {
    const configs = await this.buildingConfigsRepository.find({
      order: { type: 'ASC' },
    });

    // Если передан userId, фильтруем уже купленные строения
    let purchasedTypes: string[] = [];
    if (userId) {
      const userBuildings = await this.buildingsRepository.find({
        where: { userId },
        select: ['type'],
      });
      purchasedTypes = userBuildings.map(b => b.type);
    }

    return configs
      .filter(config => !purchasedTypes.includes(config.type))
      .map(config => ({
        id: config.id,
        type: config.type,
        name: config.name,
        icon: config.icon,
        image: config.image,
        basePrice: Number(config.basePrice),
        baseIncomePerHour: Number(config.baseIncomePerHour),
        maxAccumulation: Number(config.maxAccumulation),
        maxLevel: config.maxLevel,
        upgradeMultiplier: config.upgradeMultiplier || 1.4,
      }));
  }

  /**
   * Получить все строения игрока
   */
  async getUserBuildings(userId: string) {
    const buildings = await this.buildingsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return buildings.map(building => ({
      id: building.id,
      type: building.type,
      level: building.level,
      accumulatedIncome: Number(building.accumulatedIncome),
      incomePerHour: Number(building.incomePerHour),
      lastIncomeCollection: building.lastIncomeCollection,
      capturedByClanId: building.capturedByClanId,
      capturedAt: building.capturedAt,
      captureExpiresAt: building.captureExpiresAt,
    }));
  }

  /**
   * Покупка строения игроком
   */
  async purchaseBuilding(userId: string, buildingConfigId: string) {
    const config = await this.buildingConfigsRepository.findOne({
      where: { id: buildingConfigId },
    });

    if (!config) {
      throw new NotFoundException('Конфигурация строения не найдена');
    }

    const user = await this.usersService.findOne(userId);
    
    // Рассчитываем цену для уровня 1 (базовая цена)
    const price = Number(config.basePrice);
    
    if (Number(user.narCoin) < price) {
      throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${price}, у вас: ${Number(user.narCoin)}`);
    }

    // Списываем средства
    const newBalance = Number(user.narCoin) - price;
    await this.usersService.update(userId, { narCoin: newBalance });

    // Рассчитываем доход для уровня 1: baseIncomePerHour * 1.2^level (где level = 1)
    // Для уровня 1: baseIncomePerHour * 1.2^1 = baseIncomePerHour * 1.2
    const incomePerHour = Math.floor(Number(config.baseIncomePerHour) * Math.pow(1.2, 1));

    // Создаем строение
    const building = this.buildingsRepository.create({
      userId,
      type: config.type,
      level: 1,
      accumulatedIncome: '0',
      incomePerHour: incomePerHour.toString(),
      lastIncomeCollection: new Date(),
    });

    await this.buildingsRepository.save(building);

    return {
      id: building.id,
      type: building.type,
      level: building.level,
      incomePerHour: Number(building.incomePerHour),
    };
  }

  /**
   * Улучшение строения
   */
  async upgradeBuilding(userId: string, buildingId: string) {
    const building = await this.buildingsRepository.findOne({
      where: { id: buildingId, userId },
    });

    if (!building) {
      throw new NotFoundException('Строение не найдено');
    }

    const config = await this.buildingConfigsRepository.findOne({
      where: { type: building.type },
    });

    if (!config) {
      throw new NotFoundException('Конфигурация строения не найдена');
    }

    if (building.level >= config.maxLevel) {
      throw new BadRequestException('Достигнут максимальный уровень');
    }

    const user = await this.usersService.findOne(userId);

    // Рассчитываем цену улучшения: basePrice * upgradeMultiplier^level
    const multiplier = config.upgradeMultiplier || 1.4;
    const upgradePrice = Math.floor(Number(config.basePrice) * Math.pow(multiplier, building.level));
    
    if (Number(user.narCoin) < upgradePrice) {
      throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${upgradePrice}, у вас: ${Number(user.narCoin)}`);
    }

    // Списываем средства
    const newBalance = Number(user.narCoin) - upgradePrice;
    await this.usersService.update(userId, { narCoin: newBalance });

    // Увеличиваем уровень
    building.level += 1;

    // Рассчитываем новый доход: baseIncomePerHour * 1.2^level
    const newIncomePerHour = Math.floor(Number(config.baseIncomePerHour) * Math.pow(1.2, building.level));
    building.incomePerHour = newIncomePerHour.toString();

    await this.buildingsRepository.save(building);

    return {
      id: building.id,
      level: building.level,
      incomePerHour: Number(building.incomePerHour),
    };
  }

  /**
   * Сбор накопленного дохода
   * Применяет бонус пассивного дохода из ветки Экономика
   */
  async collectIncome(userId: string, buildingId: string) {
    const building = await this.buildingsRepository.findOne({
      where: { id: buildingId, userId },
    });

    if (!building) {
      throw new NotFoundException('Строение не найдено');
    }

    // Получаем пользователя для расчета бонуса пассивного дохода
    const user = await this.usersService.findOne(userId);

    // Рассчитываем накопленный доход
    const now = new Date();
    const lastCollection = building.lastIncomeCollection || building.createdAt;
    const hoursPassed = (now.getTime() - lastCollection.getTime()) / (1000 * 60 * 60);

    // Если строение захвачено кланом, доход уменьшается на 50%
    const captureMultiplier = building.capturedByClanId ? 0.5 : 1.0;
    
    // Применяем бонус пассивного дохода из ветки Экономика
    const passiveIncomeMultiplier = this.branchesService.calculatePassiveIncomeMultiplier(
      user.economySp || 0
    );
    
    const baseIncomePerHour = Number(building.incomePerHour);
    const incomePerHour = baseIncomePerHour * captureMultiplier * passiveIncomeMultiplier;
    
    const incomeToAdd = Math.floor(incomePerHour * hoursPassed);
    const newAccumulated = Number(building.accumulatedIncome) + incomeToAdd;

    const config = await this.buildingConfigsRepository.findOne({
      where: { type: building.type },
    });

    // Ограничиваем максимальным накоплением
    const maxAccumulation = config ? Number(config.maxAccumulation) : Infinity;
    const finalIncome = Math.min(newAccumulated, maxAccumulation);

    // Обновляем строение
    building.accumulatedIncome = finalIncome.toString();
    building.lastIncomeCollection = now;
    await this.buildingsRepository.save(building);

    // Добавляем доход игроку
    const newBalance = Number(user.narCoin) + finalIncome;
    await this.usersService.update(userId, { narCoin: newBalance });

    // Сбрасываем накопленный доход
    building.accumulatedIncome = '0';
    await this.buildingsRepository.save(building);

    return {
      collected: finalIncome,
      newBalance: newBalance,
      passiveIncomeBonus: passiveIncomeMultiplier > 1 ? `${((passiveIncomeMultiplier - 1) * 100).toFixed(1)}%` : '0%',
    };
  }

  /**
   * Захват района кланом
   * Захватывает район (district) вместо строений
   */
  async captureDistrict(clanId: string, districtCode: string) {
    // Проверяем, что район существует
    const districtConfig = await this.districtConfigsRepository.findOne({
      where: { code: districtCode },
    });

    if (!districtConfig) {
      throw new NotFoundException('Район не найден');
    }

    // Проверяем, не захвачен ли уже район другим кланом
    const existingCapture = await this.districtCapturesRepository.findOne({
      where: { districtCode },
      order: { capturedAt: 'DESC' },
    });

    if (existingCapture && existingCapture.capturedByClanId !== clanId) {
      // Проверяем, не истек ли срок захвата
      if (existingCapture.expiresAt && existingCapture.expiresAt > new Date()) {
        throw new BadRequestException('Район уже захвачен другим кланом');
      }
    }

    // Получаем клан
    const clan = await this.clansService.findOne(clanId);

    // Если район уже захвачен этим кланом, обновляем время захвата
    if (existingCapture && existingCapture.capturedByClanId === clanId) {
      const now = new Date();
      // Захват на 24 часа
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      existingCapture.capturedAt = now;
      existingCapture.expiresAt = expiresAt;
      await this.districtCapturesRepository.save(existingCapture);

      // Обновляем ownedDistricts в клане
      const ownedDistricts = (clan.ownedDistricts || []) as District[];
      if (!ownedDistricts.includes(districtCode as District)) {
        ownedDistricts.push(districtCode as District);
        clan.ownedDistricts = ownedDistricts;
        await this.clansRepository.save(clan);
      }

      return {
        districtCode,
        capturedAt: now,
        expiresAt,
        message: 'Захват района продлен',
      };
    }

    // Создаем новый захват
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 часа

    const capture = this.districtCapturesRepository.create({
      districtCode,
      capturedByClanId: clanId,
      capturedAt: now,
      expiresAt,
      totalIncomeCollected: '0',
      lastIncomeCollection: null,
    });

    await this.districtCapturesRepository.save(capture);

    // Обновляем ownedDistricts в клане
    const ownedDistricts = (clan.ownedDistricts || []) as District[];
    if (!ownedDistricts.includes(districtCode as District)) {
      ownedDistricts.push(districtCode as District);
      clan.ownedDistricts = ownedDistricts;
      await this.clansRepository.save(clan);
    }

    return {
      districtCode,
      capturedAt: now,
      expiresAt,
      message: 'Район успешно захвачен',
    };
  }

  /**
   * Получить захваченные районы клана
   */
  async getClanDistricts(clanId: string) {
    const captures = await this.districtCapturesRepository.find({
      where: { capturedByClanId: clanId },
      order: { capturedAt: 'DESC' },
    });

    const districts = await Promise.all(
      captures.map(async (capture) => {
        const config = await this.districtConfigsRepository.findOne({
          where: { code: capture.districtCode },
        });

        return {
          districtCode: capture.districtCode,
          districtName: config?.name || capture.districtCode,
          capturedAt: capture.capturedAt,
          expiresAt: capture.expiresAt,
          totalIncomeCollected: Number(capture.totalIncomeCollected),
          baseIncomePerDay: config ? Number(config.baseIncomePerDay) : 0,
        };
      }),
    );

    return districts;
  }

  /**
   * Собрать доход с захваченного района
   */
  async collectDistrictIncome(clanId: string, districtCode: string) {
    const capture = await this.districtCapturesRepository.findOne({
      where: { districtCode, capturedByClanId: clanId },
    });

    if (!capture) {
      throw new NotFoundException('Район не захвачен вашим кланом');
    }

    const districtConfig = await this.districtConfigsRepository.findOne({
      where: { code: districtCode },
    });

    if (!districtConfig) {
      throw new NotFoundException('Конфигурация района не найдена');
    }

    const now = new Date();
    const lastCollection = capture.lastIncomeCollection || capture.capturedAt;
    const daysPassed = (now.getTime() - lastCollection.getTime()) / (1000 * 60 * 60 * 24);

    const baseIncomePerDay = Number(districtConfig.baseIncomePerDay);
    const incomeToAdd = Math.floor(baseIncomePerDay * daysPassed);

    if (incomeToAdd <= 0) {
      return {
        collected: 0,
        message: 'Доход еще не накоплен',
      };
    }

    // Обновляем захват
    capture.totalIncomeCollected = (Number(capture.totalIncomeCollected) + incomeToAdd).toString();
    capture.lastIncomeCollection = now;
    await this.districtCapturesRepository.save(capture);

    // Добавляем доход в казну клана
    const clan = await this.clansService.findOne(clanId);
    const currentTreasury = Number(clan.treasury || 0);
    clan.treasury = (currentTreasury + incomeToAdd).toString();
    await this.clansRepository.save(clan);

    return {
      collected: incomeToAdd,
      newTreasury: Number(clan.treasury),
    };
  }

  /**
   * Получить все доступные районы для захвата
   */
  async getAvailableDistrictsForCapture(clanId: string) {
    const allDistricts = await this.districtConfigsRepository.find({
      where: { isActive: true },
      order: { order: 'ASC' },
    });

    const captures = await this.districtCapturesRepository.find({
      where: { capturedByClanId: Not(clanId) },
    });

    const now = new Date();
    const activeCaptures = captures.filter(
      (c) => !c.expiresAt || c.expiresAt > now,
    );

    const capturedCodes = new Set(activeCaptures.map((c) => c.districtCode));

    return allDistricts.map((district) => ({
      code: district.code,
      name: district.name,
      description: district.description,
      icon: district.icon,
      image: district.image,
      baseIncomePerDay: Number(district.baseIncomePerDay),
      isCaptured: capturedCodes.has(district.code),
      capturedBy: activeCaptures.find((c) => c.districtCode === district.code)?.capturedByClanId || null,
    }));
  }

  /**
   * @deprecated Используйте captureDistrict вместо этого
   * Захват строения кланом (старая логика - оставлена для обратной совместимости)
   */
  async captureTerritory(clanId: string, buildingType: string) {
    // Получаем конфигурацию строения
    const config = await this.buildingConfigsRepository.findOne({
      where: { type: buildingType },
    });

    if (!config) {
      throw new NotFoundException('Тип строения не найден');
    }

    // Получаем все строения этого типа, которые не захвачены
    const availableBuildings = await this.buildingsRepository.find({
      where: {
        type: buildingType,
        capturedByClanId: null,
      },
    });

    if (availableBuildings.length === 0) {
      throw new BadRequestException('Нет доступных строений для захвата');
    }

    // Получаем клан для подсчета количества участников
    const clan = await this.clansService.findOne(clanId);
    const memberCount = clan.memberCount || 1;

    // Выбираем случайных игроков (количество = количеству участников клана, но не больше доступных строений)
    const targetCount = Math.min(memberCount, availableBuildings.length);
    const shuffled = availableBuildings.sort(() => Math.random() - 0.5);
    const targetBuildings = shuffled.slice(0, targetCount);

    // Устанавливаем захват на 3 часа
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 часа

    let totalIncome = 0;

    // Захватываем строения у выбранных игроков
    for (const building of targetBuildings) {
      building.capturedByClanId = clanId;
      building.capturedAt = now;
      building.captureExpiresAt = expiresAt;

      // Снижаем доход на 50% (доход уже учитывается при расчете, просто сохраняем)
      // Доход игрока будет рассчитываться с учетом захвата (50% от обычного)
      
      // Добавляем 20% от дохода в казну клана
      const incomeForClan = Math.floor(Number(building.incomePerHour) * 0.2);
      totalIncome += incomeForClan;

      await this.buildingsRepository.save(building);
    }

    // Добавляем доход в казну клана
    if (totalIncome > 0) {
      const currentTreasury = Number(clan.treasury || 0);
      clan.treasury = (currentTreasury + totalIncome).toString();
      await this.clansRepository.save(clan);
    }

    return {
      capturedCount: targetBuildings.length,
      totalIncome,
      capturedAt: now,
      expiresAt,
    };
  }

  /**
   * Получить доход клана от захваченных строений (20% от дохода в час)
   */
  async getClanIncomeFromCaptures(clanId: string): Promise<number> {
    const capturedBuildings = await this.buildingsRepository.find({
      where: {
        capturedByClanId: clanId,
      },
    });

    let totalIncome = 0;
    for (const building of capturedBuildings) {
      // 20% от дохода в час
      totalIncome += Math.floor(Number(building.incomePerHour) * 0.2);
    }

    return totalIncome;
  }

  /**
   * Освобождение захваченных строений (вызывается периодически)
   */
  async releaseExpiredCaptures() {
    const now = new Date();
    const expiredBuildings = await this.buildingsRepository.find({
      where: {
        capturedByClanId: Not(null),
      },
    });

    const toRelease = expiredBuildings.filter(
      b => b.captureExpiresAt && b.captureExpiresAt <= now
    );

    for (const building of toRelease) {
      building.capturedByClanId = null;
      building.capturedAt = null;
      building.captureExpiresAt = null;
      await this.buildingsRepository.save(building);
    }

    return toRelease.length;
  }

  /**
   * Получить настройки автобилда для пользователя
   */
  async getAutobuildSettings(userId: string) {
    const user = await this.usersService.findOne(userId);
    return {
      minBalance: Number(user.autobuildMinBalance || 0),
      strategy: user.autobuildStrategy || 'balanced',
      priorityBuilding: user.autobuildPriorityBuilding || null,
    };
  }

  /**
   * Сохранить настройки автобилда для пользователя
   */
  async saveAutobuildSettings(
    userId: string,
    settings: { minBalance: number; strategy: string; priorityBuilding?: string | null },
  ) {
    const user = await this.usersService.findOne(userId);
    user.autobuildMinBalance = BigInt(settings.minBalance);
    user.autobuildStrategy = settings.strategy;
    user.autobuildPriorityBuilding = settings.priorityBuilding || null;
    // Сохраняем напрямую через репозиторий, так как эти поля не в UpdateUserDto
    await this.usersRepository.save(user);
    return {
      minBalance: Number(user.autobuildMinBalance),
      strategy: user.autobuildStrategy,
      priorityBuilding: user.autobuildPriorityBuilding,
    };
  }
}

