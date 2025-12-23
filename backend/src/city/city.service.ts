import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Building } from './building.entity';
import { BuildingConfig } from './building-config.entity';
import { UsersService } from '../users/users.service';
import { ClansService } from '../clans/clans.service';

@Injectable()
export class CityService {
  constructor(
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
    @InjectRepository(BuildingConfig)
    private buildingConfigsRepository: Repository<BuildingConfig>,
    private usersService: UsersService,
    @Inject(forwardRef(() => ClansService))
    private clansService: ClansService,
  ) {}

  /**
   * Получить все доступные конфигурации строений
   */
  async getAvailableBuildings() {
    const configs = await this.buildingConfigsRepository.find({
      order: { type: 'ASC' },
    });

    return configs.map(config => ({
      id: config.id,
      type: config.type,
      name: config.name,
      icon: config.icon,
      image: config.image,
      basePrice: Number(config.basePrice),
      baseIncomePerHour: Number(config.baseIncomePerHour),
      maxAccumulation: Number(config.maxAccumulation),
      maxLevel: config.maxLevel,
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

    // Рассчитываем доход для уровня 1
    const incomePerHour = Number(config.baseIncomePerHour);

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

    // Рассчитываем цену улучшения: basePrice * 1.4^level
    const upgradePrice = Math.floor(Number(config.basePrice) * Math.pow(1.4, building.level));
    
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
   */
  async collectIncome(userId: string, buildingId: string) {
    const building = await this.buildingsRepository.findOne({
      where: { id: buildingId, userId },
    });

    if (!building) {
      throw new NotFoundException('Строение не найдено');
    }

    // Рассчитываем накопленный доход
    const now = new Date();
    const lastCollection = building.lastIncomeCollection || building.createdAt;
    const hoursPassed = (now.getTime() - lastCollection.getTime()) / (1000 * 60 * 60);

    // Если строение захвачено кланом, доход уменьшается на 50%
    const incomeMultiplier = building.capturedByClanId ? 0.5 : 1.0;
    const incomePerHour = Number(building.incomePerHour) * incomeMultiplier;
    
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
    const user = await this.usersService.findOne(userId);
    const newBalance = Number(user.narCoin) + finalIncome;
    await this.usersService.update(userId, { narCoin: newBalance });

    // Сбрасываем накопленный доход
    building.accumulatedIncome = '0';
    await this.buildingsRepository.save(building);

    return {
      collected: finalIncome,
      newBalance: newBalance,
    };
  }

  /**
   * Захват строения кланом
   * Захватывает у случайных игроков строения указанного типа
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
      await this.clansService.update(clanId, { treasury: clan.treasury });
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
}

