import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Business, BusinessClass } from './business.entity';
import { PlayerBusiness } from './player-business.entity';
import { District, DistrictName } from './district.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { getBusinessConfig, getBusinessLevelConfig, BUSINESS_CLASS_A, BUSINESS_CLASS_B, BUSINESS_CLASS_C } from './business-economy.config';
import { MaterialPackage } from './business.entity';
import { MaterialService } from './material.service';
import { DistrictName } from './district.entity';

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);
  private readonly COLLECTION_CAP_HOURS = 4; // Максимум 4 часа накопления

  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(PlayerBusiness)
    private playerBusinessRepository: Repository<PlayerBusiness>,
    @InjectRepository(District)
    private districtRepository: Repository<District>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private usersService: UsersService,
    private materialService: MaterialService,
  ) {}

  /**
   * Получить все бизнесы в районе
   */
  async getBusinessesByDistrict(districtName: DistrictName): Promise<Business[]> {
    const district = await this.districtRepository.findOne({ where: { name: districtName } });
    if (!district) {
      throw new NotFoundException(`Район ${districtName} не найден`);
    }
    return this.businessRepository.find({
      where: { districtId: district.id, isActive: true },
      order: { order: 'ASC' },
    });
  }

  /**
   * Получить бизнесы игрока
   */
  async getPlayerBusinesses(playerId: string): Promise<PlayerBusiness[]> {
    return this.playerBusinessRepository.find({
      where: { playerId },
      relations: ['business', 'business.district'],
    });
  }

  /**
   * Купить бизнес
   */
  async purchaseBusiness(playerId: string, businessId: string): Promise<PlayerBusiness> {
    const user = await this.userRepository.findOne({ where: { id: playerId } });
    if (!user) {
      throw new NotFoundException('Игрок не найден');
    }

    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      relations: ['district'],
    });
    if (!business) {
      throw new NotFoundException('Бизнес не найден');
    }

    // Проверка лицензии предпринимателя
    if (!user.hasBusinessLicense) {
      throw new BadRequestException('Требуется лицензия предпринимателя');
    }

    // Проверка уровня
    if (user.level < business.minLevel) {
      throw new BadRequestException(`Требуется уровень ${business.minLevel}`);
    }

    // Проверка, что у игрока нет этого бизнеса
    const existing = await this.playerBusinessRepository.findOne({
      where: { playerId, businessId },
    });
    if (existing) {
      throw new BadRequestException('У вас уже есть этот бизнес');
    }

    // Получаем конфигурацию для уровня 1
    const config = getBusinessLevelConfig(business.businessClass, 1);
    if (!config) {
      throw new BadRequestException('Неверная конфигурация бизнеса');
    }

    // Проверка баланса
    if (user.narCoin < BigInt(config.costNar)) {
      throw new BadRequestException('Недостаточно NAR');
    }

    // Списываем NAR
    user.narCoin = user.narCoin - BigInt(config.costNar);
    await this.userRepository.save(user);

    // Создаем бизнес игрока
    const playerBusiness = this.playerBusinessRepository.create({
      playerId,
      businessId,
      level: 1,
      narAccumulated: BigInt(0),
      materialsAccumulated: BigInt(0),
      lastCollectedAt: new Date(),
    });

    return this.playerBusinessRepository.save(playerBusiness);
  }

  /**
   * Улучшить бизнес
   */
  async upgradeBusiness(playerId: string, playerBusinessId: string): Promise<PlayerBusiness> {
    const playerBusiness = await this.playerBusinessRepository.findOne({
      where: { id: playerBusinessId, playerId },
      relations: ['business'],
    });
    if (!playerBusiness) {
      throw new NotFoundException('Бизнес не найден');
    }

    if (playerBusiness.level >= 10) {
      throw new BadRequestException('Бизнес уже максимального уровня');
    }

    const user = await this.userRepository.findOne({ where: { id: playerId } });
    if (!user) {
      throw new NotFoundException('Игрок не найден');
    }

    const nextLevel = playerBusiness.level + 1;
    const config = getBusinessLevelConfig(playerBusiness.business.businessClass, nextLevel);
    if (!config) {
      throw new BadRequestException('Неверная конфигурация уровня');
    }

    // Проверка уровня игрока
    if (config.requiredLevel && user.level < config.requiredLevel) {
      throw new BadRequestException(`Требуется уровень ${config.requiredLevel}`);
    }

    // Проверка баланса
    if (user.narCoin < BigInt(config.costNar)) {
      throw new BadRequestException('Недостаточно NAR');
    }

    // Проверка материалов (если требуется)
    if (config.requiredMaterials) {
      const hasMaterials = await this.materialService.hasEnoughMaterials(
        playerId,
        playerBusiness.business.materialPackage,
        config.requiredMaterials,
        nextLevel <= 6 ? [1, 2] : nextLevel <= 8 ? [2, 3] : [3, 4],
      );
      if (!hasMaterials) {
        throw new BadRequestException('Недостаточно материалов');
      }
    }

    // Списываем NAR
    user.narCoin = user.narCoin - BigInt(config.costNar);
    await this.userRepository.save(user);

    // Списываем материалы (если требуется)
    if (config.requiredMaterials) {
      await this.materialService.spendMaterials(
        playerId,
        playerBusiness.business.materialPackage,
        config.requiredMaterials,
        nextLevel <= 6 ? [1, 2] : nextLevel <= 8 ? [2, 3] : [3, 4],
      );
    }

    // Улучшаем бизнес
    playerBusiness.level = nextLevel;
    return this.playerBusinessRepository.save(playerBusiness);
  }

  /**
   * Собрать прибыль с бизнеса
   */
  async collectProfit(playerId: string, playerBusinessId: string): Promise<{ nar: number; materials: number }> {
    const playerBusiness = await this.playerBusinessRepository.findOne({
      where: { id: playerBusinessId, playerId },
      relations: ['business'],
    });
    if (!playerBusiness) {
      throw new NotFoundException('Бизнес не найден');
    }

    const config = getBusinessLevelConfig(playerBusiness.business.businessClass, playerBusiness.level);
    if (!config) {
      throw new BadRequestException('Неверная конфигурация уровня');
    }

    // Вычисляем время с последнего сбора
    const now = new Date();
    const lastCollected = playerBusiness.lastCollectedAt || playerBusiness.createdAt;
    const hoursPassed = (now.getTime() - lastCollected.getTime()) / (1000 * 60 * 60);
    const cappedHours = Math.min(hoursPassed, this.COLLECTION_CAP_HOURS);

    // Вычисляем прибыль
    const narToCollect = Math.floor(config.narPerHour * cappedHours);
    const materialsToCollect = Math.floor(this.getMaterialsPerHour(playerBusiness.business.materialPackage, config.narPerHour) * cappedHours);

    if (narToCollect === 0 && materialsToCollect === 0) {
      throw new BadRequestException('Нет прибыли для сбора');
    }

    const user = await this.userRepository.findOne({ where: { id: playerId } });
    if (!user) {
      throw new NotFoundException('Игрок не найден');
    }

    // Начисляем NAR
    if (narToCollect > 0) {
      user.narCoin = user.narCoin + BigInt(narToCollect);
      await this.userRepository.save(user);
    }

    // Начисляем материалы
    if (materialsToCollect > 0) {
      await this.materialService.addMaterialsFromBusiness(
        playerId,
        playerBusiness.business.materialPackage,
        materialsToCollect,
      );
    }

    // Обновляем время последнего сбора
    playerBusiness.lastCollectedAt = now;
    playerBusiness.narAccumulated = BigInt(0);
    playerBusiness.materialsAccumulated = BigInt(0);
    await this.playerBusinessRepository.save(playerBusiness);

    return { nar: narToCollect, materials: materialsToCollect };
  }

  /**
   * Вычисляет количество материалов в час для бизнеса
   */
  private getMaterialsPerHour(materialPackage: MaterialPackage, narPerHour: number): number {
    // Базовая формула: материалы = NAR/час * коэффициент
    // Коэффициент зависит от класса бизнеса и пакета материалов
    const baseRate = narPerHour / 10; // Базовый коэффициент
    return Math.max(1, Math.floor(baseRate));
  }

  /**
   * Автосбор для управляющего (вызывается по расписанию)
   */
  async autoCollectForManager(playerBusinessId: string): Promise<void> {
    const playerBusiness = await this.playerBusinessRepository.findOne({
      where: { id: playerBusinessId },
      relations: ['business'],
    });
    if (!playerBusiness) {
      return;
    }

    // Проверяем, что есть управляющий и он не истек
    if (!playerBusiness.hasManager || (playerBusiness.managerExpiresAt && playerBusiness.managerExpiresAt < new Date())) {
      return;
    }

    try {
      await this.collectProfit(playerBusiness.playerId, playerBusinessId);
    } catch (error) {
      this.logger.error(`Ошибка автосбора для бизнеса ${playerBusinessId}: ${error.message}`);
    }
  }

  /**
   * Получить информацию о бизнесе для отображения
   */
  async getBusinessInfo(businessId: string, playerId?: string): Promise<any> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      relations: ['district'],
    });
    if (!business) {
      throw new NotFoundException('Бизнес не найден');
    }

    const config = getBusinessConfig(business.businessClass);
    const playerBusiness = playerId
      ? await this.playerBusinessRepository.findOne({
          where: { playerId, businessId },
        })
      : null;

    return {
      ...business,
      levels: config,
      playerBusiness: playerBusiness
        ? {
            ...playerBusiness,
            canUpgrade: playerBusiness.level < 10,
            nextLevelConfig: config.find(c => c.level === playerBusiness.level + 1),
          }
        : null,
    };
  }
}

