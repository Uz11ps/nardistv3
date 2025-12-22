import { Injectable, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Building, District, BuildingType } from './building.entity';
import { BuildingConfig } from './building-config.entity';
import { DistrictConfig } from './district-config.entity';
import { UsersService } from '../users/users.service';
import { ClansService } from '../clans/clans.service';
import { QuestsService } from '../quests/quests.service';
import { TrainingService } from '../training/training.service';
import { TaskType } from '../training/training-task.entity';
import { QuestTarget } from '../quests/quest.entity';

@Injectable()
export class CityService {
  private readonly INCOME_CAP = 10000;
  private readonly CAPTURE_COOLDOWN_DAYS = 3; // Клан может захватить территорию раз в 3 дня

  constructor(
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
    @InjectRepository(BuildingConfig)
    private buildingConfigsRepository: Repository<BuildingConfig>,
    @InjectRepository(DistrictConfig)
    private districtConfigsRepository: Repository<DistrictConfig>,
    private usersService: UsersService,
    @Inject(forwardRef(() => ClansService))
    private clansService: ClansService,
    private questsService: QuestsService,
    @Inject(forwardRef(() => TrainingService))
    private trainingService: TrainingService,
  ) {}

  async getCity(userId: string): Promise<Building[]> {
    // Проверяем уровень пользователя
    const user = await this.usersService.findOne(userId);
    const userLevel = user?.level || 0;
    if (userLevel < 5) {
      throw new BadRequestException('Город доступен с 5 уровня');
    }
    return this.buildingsRepository.find({ where: { userId } });
  }

  async collectIncome(userId: string, buildingId: string): Promise<number> {
    const building = await this.buildingsRepository.findOne({
      where: { id: buildingId, userId },
    });

    if (!building) {
      throw new BadRequestException('Здание не найдено');
    }

    const now = new Date();
    const lastCollected = building.lastCollectedAt || building.createdAt;
    const hoursPassed = Math.max(0, (now.getTime() - lastCollected.getTime()) / (1000 * 60 * 60));
    
    const incomePerHour = Number(building.incomePerHour || 0);
    const maxAccumulation = Number(building.maxAccumulation || this.INCOME_CAP);
    
    const accumulated = Number(building.accumulatedIncome || 0);
    
    // Вычисляем доход за прошедшее время
    const calculatedIncome = Math.floor(incomePerHour * hoursPassed);
    
    // Доход не может превысить максимальное накопление
    const totalIncome = Math.min(calculatedIncome, maxAccumulation - accumulated);
    
    if (totalIncome <= 0) {
      return 0;
    }

    // Если предприятие захвачено кланом, применяем разделение дохода
    let playerIncome = totalIncome;
    let clanIncome = 0;
    let platformFee = 0;

    if (building.capturedByClanId) {
      // 50% игроку, 10% клану, 40% комиссия платформе
      playerIncome = Math.floor(totalIncome * 0.5);
      clanIncome = Math.floor(totalIncome * 0.1);
      platformFee = totalIncome - playerIncome - clanIncome; // Остаток идет в комиссию
      
      // Начисляем клану
      if (clanIncome > 0) {
        const clan = await this.clansService.findOne(building.capturedByClanId);
        if (clan) {
          clan.treasury = (BigInt(clan.treasury || 0) + BigInt(clanIncome)).toString();
          await this.clansService['clansRepository'].save(clan);
        }
      }
    } else {
      // Если не захвачено, игрок получает 100%
      playerIncome = totalIncome;
    }

    // Обновляем накопленный доход
    building.accumulatedIncome = (BigInt(building.accumulatedIncome || 0) + BigInt(totalIncome)).toString();
    building.lastCollectedAt = now;
    await this.buildingsRepository.save(building);

    // Начисляем пользователю
    if (playerIncome > 0) {
      const user = await this.usersService.findOne(userId);
      user.narCoin = BigInt(user.narCoin || 0) + BigInt(playerIncome);
      await this.usersService['usersRepository'].save(user);
      
      // Обновляем квесты на сбор дохода
      try {
        await this.questsService.updateProgress(userId, QuestTarget.COLLECT_INCOME, 1);
      } catch (error) {
        // Логируем ошибку, но не прерываем процесс
        // Используем console.error, так как Logger может быть не доступен в CityService
        console.error('Ошибка при обновлении квестов collect_income:', error);
      }
      
      // Обновляем задания обучения на сбор дохода
      try {
        await this.trainingService.updateTaskProgress(userId, TaskType.COLLECT_INCOME, 1);
      } catch (error) {
        console.error('Ошибка при обновлении заданий обучения collect_income:', error);
      }
    }

    return playerIncome;
  }

  async autoCollectAllIncome(userId: string, paymentMethod: 'nar' | 'ton'): Promise<{ totalIncome: number; cost: number }> {
    const buildings = await this.getCity(userId);
    const user = await this.usersService.findOne(userId);
    
    if (!user) {
      throw new BadRequestException('Пользователь не найден');
    }

    // Стоимость автоматического сбора
    const costNar = 100000;
    const costTon = 50; // 50 TON (примерно $50)

    // Проверяем баланс в зависимости от метода оплаты
    if (paymentMethod === 'nar') {
      const userNarCoin = typeof user.narCoin === 'bigint' ? Number(user.narCoin) : (user.narCoin || 0);
      if (userNarCoin < costNar) {
        throw new BadRequestException(`Недостаточно NAR. Требуется: ${costNar}, у вас: ${userNarCoin}`);
      }
      // Списываем NAR
      user.narCoin = BigInt(userNarCoin - costNar);
      await this.usersService['usersRepository'].save(user);
    } else if (paymentMethod === 'ton') {
      // Здесь должна быть логика проверки TON баланса и списания
      // Пока просто проверяем наличие метода оплаты
      throw new BadRequestException('Оплата через TON пока не реализована');
    }

    // Собираем доход со всех зданий
    let totalIncome = 0;
    const now = new Date();

    for (const building of buildings) {
      if (building.accumulatedIncome && BigInt(building.accumulatedIncome) > 0) {
        const income = await this.collectIncome(userId, building.id);
        totalIncome += income;
      }
    }

    return { totalIncome, cost: paymentMethod === 'nar' ? costNar : costTon };
  }

  private async getDistrictConfig(district: District): Promise<{ incomePerHour: number; maxAccumulation: number }> {
    // Дефолтные значения для каждого района
    const configs: Record<District, { incomePerHour: number; maxAccumulation: number }> = {
      [District.DISTRICT_1]: { incomePerHour: 10, maxAccumulation: 240 },
      [District.DISTRICT_2]: { incomePerHour: 15, maxAccumulation: 360 },
      [District.DISTRICT_3]: { incomePerHour: 20, maxAccumulation: 480 },
      [District.DISTRICT_4]: { incomePerHour: 25, maxAccumulation: 600 },
      [District.DISTRICT_5]: { incomePerHour: 30, maxAccumulation: 720 },
      [District.DISTRICT_6]: { incomePerHour: 40, maxAccumulation: 960 },
      [District.DISTRICT_7]: { incomePerHour: 50, maxAccumulation: 1200 },
    };
    
    return configs[district] || { incomePerHour: 10, maxAccumulation: 240 };
  }

  async upgradeBuilding(userId: string, buildingId: string): Promise<Building> {
    const building = await this.buildingsRepository.findOne({
      where: { id: buildingId, userId },
    });

    if (!building) {
      throw new BadRequestException('Здание не найдено');
    }

    // Получаем конфигурацию для расчета стоимости улучшения
    const config = await this.buildingConfigsRepository.findOne({
      where: { district: building.district, type: building.type },
    });

    if (!config) {
      throw new BadRequestException('Конфигурация не найдена');
    }

    // Проверяем максимальный уровень
    if (building.level >= config.maxLevel) {
      throw new BadRequestException('Достигнут максимальный уровень');
    }

    // Вычисляем стоимость улучшения
    const upgradeCosts = config.upgradeCosts || {};
    const upgradeCost = upgradeCosts[building.level] || (building.level * 1000);

    const user = await this.usersService.findOne(userId);

    if (Number(user.narCoin) < upgradeCost) {
      throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${upgradeCost}`);
    }

    // Списываем средства
    user.narCoin = BigInt(user.narCoin || 0) - BigInt(upgradeCost);
    await this.usersService['usersRepository'].save(user);

    // Улучшаем предприятие
    building.level++;
    // Увеличиваем доход на 20% за уровень
    building.incomePerHour = (BigInt(building.incomePerHour || 0) * BigInt(120) / BigInt(100)).toString();
    // Увеличиваем максимальное накопление на 20%
    building.maxAccumulation = (BigInt(building.maxAccumulation || 0) * BigInt(120) / BigInt(100)).toString();
    
    return this.buildingsRepository.save(building);
  }

  async getDistricts(userId?: string): Promise<any[]> {
    // Проверяем уровень для доступа к городу
    if (!userId) {
      throw new BadRequestException('Требуется авторизация');
    }
    const user = await this.usersService.findOne(userId);
    const userLevel = user?.level || 0;
    if (userLevel < 5) {
      throw new BadRequestException('Город доступен с 5 уровня');
    }
    
    // Получаем активные территории из БД
    const districtConfigs = await this.districtConfigsRepository.find({
      where: { isActive: true },
      order: { order: 'ASC' },
    });
    
    // Получаем конфигурации предприятий для каждого района
    const configs = await this.buildingConfigsRepository.find();
    
    // Получаем предприятия пользователя
    const userBuildings = userId ? await this.buildingsRepository.find({ where: { userId } }) : [];
    
    // Получаем все захваченные предприятия
    const allBuildings = await this.buildingsRepository.find();
    const capturedBuildings = allBuildings.filter(b => b.capturedByClanId !== null);
    
    const districtsData = await Promise.all(
      districtConfigs.map(async (districtConfig) => {
        const districtCode = districtConfig.code as District;
        const requiredLevel = districtConfig.requiredLevel || 1;
        const isUnlocked = userLevel >= requiredLevel;
        
        // Находим предприятия в этом районе
        const districtBuildings = await this.buildingsRepository.find({
          where: { district: districtCode },
        });
        
        // Находим предприятия пользователя в этом районе
        const userBuilding = userBuildings.find(b => b.district === districtCode);
        
        // Находим захваченные предприятия в этом районе
        const capturedInDistrict = capturedBuildings.filter(b => b.district === districtCode);
        
        // Получаем конфигурации для этого района
        const districtConfigsForBuildings = configs.filter(c => c.district === districtCode);
        
        return {
          id: districtCode,
          code: districtConfig.code,
          name: districtConfig.name,
          description: districtConfig.description,
          order: districtConfig.order,
          baseIncomePerDay: Number(districtConfig.baseIncomePerDay),
          metadata: districtConfig.metadata,
          requiredLevel,
          isUnlocked,
          userBuilding: userBuilding ? {
            id: userBuilding.id,
            type: userBuilding.type,
            level: userBuilding.level,
            incomePerHour: Number(userBuilding.incomePerHour),
            accumulatedIncome: Number(userBuilding.accumulatedIncome),
            maxAccumulation: Number(userBuilding.maxAccumulation),
            capturedByClanId: userBuilding.capturedByClanId,
            capturedAt: userBuilding.capturedAt,
          } : null,
          availableBuildings: districtConfigsForBuildings.map(c => ({
            type: c.type,
            name: this.getBuildingTypeName(c.type),
            price: Number(c.basePrice),
            incomePerHour: Number(c.baseIncomePerHour),
            maxAccumulation: Number(c.maxAccumulation),
          })),
          capturedCount: capturedInDistrict.length,
        };
      })
    );
    
    // Если у пользователя включен автобилд, пытаемся автоматически купить доступные постройки
    if (user.hasCityAutobuild) {
      await this.processAutobuild(userId, districtsData);
    }
    
    return districtsData;
  }

  /**
   * Автоматическая покупка построек при включенном автобилде
   */
  private async processAutobuild(userId: string, districtsData: any[]): Promise<void> {
    try {
      const user = await this.usersService.findOne(userId);
      let userBalance = Number(user.narCoin);

      for (const district of districtsData) {
        // Если у пользователя уже есть постройка в этом районе, пропускаем
        if (district.userBuilding) {
          continue;
        }

        // Если район не разблокирован, пропускаем
        if (!district.isUnlocked) {
          continue;
        }

        // Находим самую дешевую доступную постройку в районе
        if (district.availableBuildings && district.availableBuildings.length > 0) {
          const cheapestBuilding = district.availableBuildings.reduce((cheapest, current) => {
            return current.price < cheapest.price ? current : cheapest;
          });

          // Если у пользователя достаточно средств, покупаем автоматически
          if (userBalance >= cheapestBuilding.price) {
            try {
              await this.purchaseBuilding(userId, district.code as District, cheapestBuilding.type as BuildingType);
              // Обновляем баланс для следующей итерации
              const updatedUser = await this.usersService.findOne(userId);
              userBalance = Number(updatedUser.narCoin);
            } catch (error) {
              // Игнорируем ошибки при автобилде (например, если постройка уже куплена)
              console.error(`Autobuild failed for district ${district.code}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in processAutobuild:', error);
      // Не выбрасываем ошибку, чтобы не ломать основной функционал
    }
  }

  async getUserBuildings(userId: string): Promise<Building[]> {
    return this.buildingsRepository.find({ where: { userId } });
  }

  async getCaptureableBuildings(userId: string, district?: District): Promise<any[]> {
    // Получаем все предприятия, которые можно захватить (не принадлежат текущему пользователю)
    const where: any = {};
    if (district) {
      where.district = district;
    }
    
    const allBuildings = await this.buildingsRepository.find({ where });
    
    // Фильтруем: исключаем предприятия текущего пользователя и уже захваченные этим кланом
    const userClan = await this.clansService.getUserClan(userId);
    const clanId = userClan?.clan?.id;

    return allBuildings
      .filter(b => {
        // Исключаем свои предприятия
        if (b.userId === userId) return false;
        
        // Если уже захвачено этим кланом, не показываем
        if (b.capturedByClanId === clanId) return false;
        
        return true;
      })
      .map(b => ({
        id: b.id,
        district: b.district,
        type: b.type,
        level: b.level,
        incomePerHour: Number(b.incomePerHour),
        capturedByClanId: b.capturedByClanId,
        ownerId: b.userId,
      }));
  }

  async purchaseBuilding(userId: string, district: District, type: BuildingType): Promise<Building> {
    // Проверяем уровень пользователя
    const user = await this.usersService.findOne(userId);
    const userLevel = user?.level || 1;
    
    // Получаем конфигурацию района
    const districtConfig = await this.districtConfigsRepository.findOne({
      where: { code: district },
    });
    
    if (districtConfig) {
      const requiredLevel = districtConfig.requiredLevel || 1;
      if (userLevel < requiredLevel) {
        throw new BadRequestException(`Для покупки в этом районе требуется уровень ${requiredLevel}. Ваш уровень: ${userLevel}`);
      }
    }
    
    // Проверяем, не купил ли уже игрок предприятие в этом районе
    const existingBuilding = await this.buildingsRepository.findOne({
      where: { userId, district },
    });

    if (existingBuilding) {
      throw new BadRequestException('Вы уже владеете предприятием в этом районе');
    }

    // Получаем конфигурацию предприятия
    const config = await this.buildingConfigsRepository.findOne({
      where: { district, type },
    });

    if (!config) {
      throw new BadRequestException('Конфигурация предприятия не найдена');
    }

    const purchasePrice = Number(config.basePrice);

    if (Number(user.narCoin) < purchasePrice) {
      throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${purchasePrice}`);
    }

    // Списываем средства
    user.narCoin = BigInt(user.narCoin || 0) - BigInt(purchasePrice);
    await this.usersService['usersRepository'].save(user);

    // Создаем предприятие
    const building = this.buildingsRepository.create({
      userId,
      district,
      type,
      level: 1,
      incomePerHour: config.baseIncomePerHour,
      maxAccumulation: config.maxAccumulation,
      purchasePrice: config.basePrice,
      accumulatedIncome: '0',
    });

    return this.buildingsRepository.save(building);
  }

  async captureTerritory(userId: string, buildingId: string): Promise<void> {
    // Проверяем что пользователь состоит в клане
    const userClan = await this.clansService.getUserClan(userId);
    if (!userClan || !userClan.clan) {
      throw new BadRequestException('Вы должны состоять в клане для захвата территорий');
    }

    const clan = await this.clansService.findOne(userClan.clan.id);
    
    // Проверяем права (только лидер или офицер)
    const member = userClan.member;
    if (!member || (member.role !== 'leader' && member.role !== 'officer')) {
      throw new BadRequestException('Только лидер и офицеры могут захватывать территории');
    }

    // Проверяем ограничение - клан может захватить только одну территорию раз в 3 дня
    if (clan.lastTerritoryCaptureAt) {
      const daysSinceLastCapture = (Date.now() - new Date(clan.lastTerritoryCaptureAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastCapture < this.CAPTURE_COOLDOWN_DAYS) {
        const remainingDays = Math.ceil(this.CAPTURE_COOLDOWN_DAYS - daysSinceLastCapture);
        throw new BadRequestException(`Клан может захватить территорию только раз в ${this.CAPTURE_COOLDOWN_DAYS} дня. Осталось: ${remainingDays} дн.`);
      }
    }

    // Получаем предприятие
    const building = await this.buildingsRepository.findOne({
      where: { id: buildingId },
    });

    if (!building) {
      throw new BadRequestException('Предприятие не найдено');
    }

    // Нельзя захватить свое же предприятие
    if (building.userId === userId) {
      throw new BadRequestException('Нельзя захватить свое предприятие');
    }

    // Проверяем, не захвачено ли уже другим кланом
    if (building.capturedByClanId && building.capturedByClanId === clan.id) {
      throw new BadRequestException('Ваш клан уже владеет этой территорией');
    }

    // Захватываем территорию
    building.capturedByClanId = clan.id;
    building.capturedAt = new Date();
    await this.buildingsRepository.save(building);

    // Обновляем время последнего захвата клана
    clan.lastTerritoryCaptureAt = new Date();
    await this.clansService['clansRepository'].save(clan);
  }

  private getDistrictName(district: District): string {
    const names: Record<District, string> = {
      [District.DISTRICT_1]: 'Центральный',
      [District.DISTRICT_2]: 'Восточный порт',
      [District.DISTRICT_3]: 'Старый квартал',
      [District.DISTRICT_4]: 'Спальный',
      [District.DISTRICT_5]: 'Пригород',
      [District.DISTRICT_6]: 'Промышленный',
      [District.DISTRICT_7]: 'Деловой',
    };
    return names[district] || district;
  }

  private getBuildingTypeName(type: BuildingType): string {
    const names: Record<BuildingType, string> = {
      [BuildingType.CLUB]: 'Клуб',
      [BuildingType.WORKSHOP]: 'Мастерская',
      [BuildingType.FACTORY]: 'Фабрика',
      [BuildingType.SCHOOL]: 'Школа',
      [BuildingType.MARKET]: 'Рынок',
      [BuildingType.ACADEMY]: 'Академия',
      [BuildingType.TEMPLE]: 'Храм',
    };
    return names[type] || type;
  }

  async initializeCity(userId: string): Promise<void> {
    const districts = Object.values(District);
    const buildingTypes = Object.values(BuildingType);

    for (let i = 0; i < districts.length; i++) {
      const building = this.buildingsRepository.create({
        userId,
        district: districts[i],
        type: buildingTypes[i % buildingTypes.length],
        level: 1,
        incomePerHour: (100 * (i + 1)).toString(),
      });
      await this.buildingsRepository.save(building);
    }
  }
}

