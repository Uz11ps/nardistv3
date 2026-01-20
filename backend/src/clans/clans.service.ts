import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Clan } from './clan.entity';
import { ClanMember, ClanRole } from './clan-member.entity';
import { ClanTreasuryTransaction, TreasuryTransactionType } from './clan-treasury-transaction.entity';
import { UsersService } from '../users/users.service';
import { DistrictConfig } from '../city/district-config.entity';
import { Building } from '../city/building.entity';
import { BuildingConfig } from '../city/building-config.entity';
import { CityService } from '../city/city.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClansService {
  private readonly logger = new Logger(ClansService.name);

  constructor(
    @InjectRepository(Clan)
    private clansRepository: Repository<Clan>,
    @InjectRepository(ClanMember)
    private membersRepository: Repository<ClanMember>,
    @InjectRepository(ClanTreasuryTransaction)
    private transactionsRepository: Repository<ClanTreasuryTransaction>,
    @InjectRepository(DistrictConfig)
    private districtConfigsRepository: Repository<DistrictConfig>,
    @InjectRepository(DistrictCapture)
    private districtCapturesRepository: Repository<DistrictCapture>,
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
    @InjectRepository(BuildingConfig)
    private buildingConfigsRepository: Repository<BuildingConfig>,
    private usersService: UsersService,
    @Inject(forwardRef(() => CityService))
    private cityService: CityService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, name: string, description?: string): Promise<Clan> {
    const existing = await this.clansRepository.findOne({ where: { name } });
    if (existing) {
      throw new BadRequestException('Клан с таким именем уже существует');
    }

    const user = await this.usersService.findOne(userId);
    if (user.level < 10) {
      throw new BadRequestException('Федерации доступны с 10 уровня');
    }

    const clan = this.clansRepository.create({
      name,
      description,
      leaderId: userId,
      memberCount: 1,
      maxMembers: 10,
    });

    const savedClan = await this.clansRepository.save(clan);

    const member = this.membersRepository.create({
      clanId: savedClan.id,
      userId,
      role: ClanRole.LEADER,
      isOnline: true,
    });

    await this.membersRepository.save(member);

    return savedClan;
  }

  async findAll(filters?: {
    active?: boolean;
    new?: boolean;
    top?: boolean;
    search?: string;
  }): Promise<Clan[]> {
    const query = this.clansRepository.createQueryBuilder('clan')
      .leftJoinAndSelect('clan.members', 'members')
      .orderBy('clan.level', 'DESC');

    if (filters?.search) {
      query.where('clan.name ILIKE :search', { search: `%${filters.search}%` });
    }

    if (filters?.active) {
      query.andWhere('clan.memberCount > 0');
    }

    if (filters?.new) {
      query.orderBy('clan.createdAt', 'DESC');
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Clan> {
    const clan = await this.clansRepository.findOne({
      where: { id },
      relations: ['members', 'members.user'],
    });

    if (!clan) {
      throw new NotFoundException('Клан не найден');
    }

    return clan;
  }

  async join(userId: string, clanId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (user.level < 10) {
      throw new BadRequestException('Федерации доступны с 10 уровня');
    }

    const existingMember = await this.membersRepository.findOne({
      where: { userId },
    });

    if (existingMember) {
      throw new BadRequestException('Вы уже состоите в клане');
    }

    const clan = await this.findOne(clanId);
    if (clan.memberCount >= clan.maxMembers) {
      throw new BadRequestException('Клан заполнен');
    }

    const member = this.membersRepository.create({
      clanId,
      userId,
      role: ClanRole.MEMBER,
      isOnline: true,
    });

    await this.membersRepository.save(member);

    clan.memberCount++;
    await this.clansRepository.save(clan);
  }

  async leave(userId: string, clanId: string): Promise<void> {
    const member = await this.membersRepository.findOne({
      where: { userId, clanId },
      relations: ['clan'],
    });

    if (!member) {
      throw new NotFoundException('Вы не состоите в этом клане');
    }

    if (member.role === ClanRole.LEADER) {
      throw new BadRequestException('Лидер не может покинуть клан. Используйте функцию "Распустить клан"');
    }

    await this.membersRepository.remove(member);

    const clan = member.clan;
    clan.memberCount--;
    await this.clansRepository.save(clan);
  }

  async disband(userId: string, clanId: string): Promise<void> {
    const clan = await this.clansRepository.findOne({
      where: { id: clanId },
    });

    if (!clan) {
      throw new NotFoundException('Клан не найден');
    }

    // Проверяем, что пользователь является лидером
    if (clan.leaderId !== userId) {
      throw new BadRequestException('Только лидер может распустить клан');
    }

    // Получаем всех участников клана
    const members = await this.membersRepository.find({
      where: { clanId },
    });

    this.logger.log(`🗑️ Распускание клана ${clan.name} (${clanId}). Участников: ${members.length}`);

    // 1. Обнуляем все захваты (освобождаем все захваченные строения)
    try {
      const capturedBuildings = await this.buildingsRepository.find({
        where: { capturedByClanId: clanId },
      });

      // Освобождаем все здания
      for (const building of capturedBuildings) {
        building.capturedByClanId = null;
        building.capturedAt = null;
        building.captureExpiresAt = null;
        await this.buildingsRepository.save(building);
      }

      this.logger.log(`✅ Освобождено ${capturedBuildings.length} захваченных строений`);
    } catch (error) {
      this.logger.error(`❌ Ошибка при освобождении захватов: ${error.message}`, error.stack);
    }

    // 2. Распределяем казну между участниками
    const treasuryAmount = BigInt(clan.treasury || 0);
    if (treasuryAmount > 0 && members.length > 0) {
      try {
        // Распределяем поровну между всеми участниками
        const amountPerMember = treasuryAmount / BigInt(members.length);
        const remainder = treasuryAmount % BigInt(members.length);

        this.logger.log(`💰 Распределение казны: ${treasuryAmount} NAR между ${members.length} участниками (по ${amountPerMember} NAR каждому)`);

        for (let i = 0; i < members.length; i++) {
          const member = members[i];
          let memberAmount = amountPerMember;

          // Остаток от деления отдаем первому участнику (лидеру)
          if (i === 0) {
            memberAmount += remainder;
          }

          if (memberAmount > 0) {
            try {
              const user = await this.usersService.findOne(member.userId);
              if (user) {
                const newBalance = BigInt(user.narCoin || 0) + memberAmount;
                await this.usersService.update(member.userId, { narCoin: Number(newBalance) });
                this.logger.log(`✅ Участнику ${member.userId} начислено ${memberAmount} NAR из казны`);
              }
            } catch (error) {
              this.logger.error(`❌ Ошибка при начислении казны участнику ${member.userId}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        this.logger.error(`❌ Ошибка при распределении казны: ${error.message}`, error.stack);
      }
    }

    // 3. Отправляем уведомления всем участникам
    const treasuryInfo = treasuryAmount > 0 && members.length > 0
      ? ` Вам начислено ${(treasuryAmount / BigInt(members.length)).toString()} NAR из казны клана.`
      : '';
    const notificationMessage = `Клан "${clan.name}" был распущен лидером. Вы больше не состоите в клане.${treasuryInfo}`;
    
    for (const member of members) {
      try {
        await this.notificationsService.createNotification(
          member.userId,
          'Клан распущен',
          notificationMessage,
          'warning',
        );
      } catch (error) {
        this.logger.error(`❌ Ошибка при отправке уведомления участнику ${member.userId}: ${error.message}`);
      }
    }

    // 4. Удаляем всех участников
    await this.membersRepository.delete({ clanId });

    // 5. Удаляем все транзакции казны
    await this.transactionsRepository.delete({ clanId });

    // 6. Удаляем клан
    await this.clansRepository.remove(clan);

    this.logger.log(`✅ Клан ${clan.name} успешно распущен. Удалено участников: ${members.length}, казна распределена`);
  }

  async getMembers(clanId: string): Promise<ClanMember[]> {
    return this.membersRepository.find({
      where: { clanId },
      relations: ['user'],
      order: { role: 'ASC', contribution: 'DESC' },
    });
  }

  async getUserClan(userId: string): Promise<{ clan: Clan | null; member: ClanMember | null }> {
    const member = await this.membersRepository.findOne({
      where: { userId },
      relations: ['clan'],
    });

    return {
      clan: member?.clan || null,
      member: member || null,
    };
  }

  async contribute(userId: string, clanId: string, amount: number): Promise<void> {
    const member = await this.membersRepository.findOne({
      where: { userId, clanId },
      relations: ['clan'],
    });

    if (!member) {
      throw new NotFoundException('Вы не состоите в этом клане');
    }

    const user = await this.usersService.findOne(userId);
    if (Number(user.narCoin) < amount) {
      throw new BadRequestException('Недостаточно NAR-coin');
    }

    const newBalance = Number(user.narCoin || 0) - amount;
    await this.usersService.update(userId, { narCoin: newBalance });

    member.contribution = (BigInt(member.contribution || 0) + BigInt(amount)).toString();
    await this.membersRepository.save(member);

    const clan = member.clan;
    clan.treasury = (BigInt(clan.treasury || 0) + BigInt(amount)).toString();
    await this.clansRepository.save(clan);

    // Создаем запись транзакции
    const transaction = this.transactionsRepository.create({
      clanId: clan.id,
      userId: userId,
      type: TreasuryTransactionType.CONTRIBUTION,
      amount: amount.toString(),
      description: 'Внес вклад',
    });
    await this.transactionsRepository.save(transaction);
  }

  async upgradeClan(userId: string, clanId: string, upgradeType: string): Promise<Clan> {
    const member = await this.membersRepository.findOne({
      where: { userId, clanId },
      relations: ['clan'],
    });

    if (!member || member.role !== ClanRole.LEADER) {
      throw new BadRequestException('Только лидер может улучшать клан');
    }

    const clan = member.clan;
    const costs: Record<string, number> = {
      level: (clan.clanLevel + 1) * 1000,
      districtStrength: (clan.districtStrength + 1) * 500,
      economy: (clan.economy + 1) * 800,
      fort: (clan.fortLevel + 1) * 1200,
    };

    const cost = costs[upgradeType];
    if (!cost) {
      throw new BadRequestException('Неверный тип улучшения');
    }

    if (Number(clan.treasury) < cost) {
      throw new BadRequestException('Недостаточно средств в казне');
    }

    clan.treasury = (BigInt(clan.treasury || 0) - BigInt(cost)).toString();

    const upgradeNames: Record<string, string> = {
      level: 'Уровень клана',
      districtStrength: 'Сила районов',
      economy: 'Экономика',
      fort: 'Форт клана',
    };
    const upgradeName = upgradeNames[upgradeType] || 'Улучшение';

    switch (upgradeType) {
      case 'level':
        clan.clanLevel++;
        clan.maxMembers += 5;
        break;
      case 'districtStrength':
        clan.districtStrength++;
        break;
      case 'economy':
        clan.economy++;
        clan.weeklyIncome = (BigInt(clan.weeklyIncome || 0) * BigInt(120) / BigInt(100)).toString();
        break;
      case 'fort':
        if (clan.fortLevel >= 10) {
          throw new BadRequestException('Форт достиг максимального уровня');
        }
        clan.fortLevel++;
        break;
    }

    const savedClan = await this.clansRepository.save(clan);

    // Создаем запись транзакции
    const transaction = this.transactionsRepository.create({
      clanId: clan.id,
      userId: userId,
      type: TreasuryTransactionType.UPGRADE,
      amount: (-cost).toString(), // Отрицательное значение
      description: `Улучшение: ${upgradeName}`,
    });
    await this.transactionsRepository.save(transaction);

    return savedClan;
  }

  async getTreasuryTransactions(clanId: string, limit: number = 10): Promise<ClanTreasuryTransaction[]> {
    return this.transactionsRepository.find({
      where: { clanId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getClanUpgrades(clanId: string): Promise<{
    level: { current: number; max: number; cost: number };
    districtStrength: { current: number; max: number; cost: number };
    economy: { current: number; max: number; cost: number };
    fort: { current: number; max: number; cost: number };
  }> {
    const clan = await this.clansRepository.findOne({ where: { id: clanId } });
    if (!clan) {
      throw new NotFoundException('Клан не найден');
    }

    return {
      level: {
        current: clan.clanLevel,
        max: 10,
        cost: (clan.clanLevel + 1) * 1000,
      },
      districtStrength: {
        current: clan.districtStrength,
        max: 10,
        cost: (clan.districtStrength + 1) * 500,
      },
      economy: {
        current: clan.economy,
        max: 10,
        cost: (clan.economy + 1) * 800,
      },
      fort: {
        current: clan.fortLevel,
        max: 10,
        cost: clan.fortLevel >= 10 ? 0 : (clan.fortLevel + 1) * 1200,
      },
    };
  }

  async getClanTerritories(clanId: string): Promise<any[]> {
    const clan = await this.findOne(clanId);
    
    if (!clan.ownedDistricts || clan.ownedDistricts.length === 0) {
      return [];
    }

    // Получаем конфигурации территорий из БД
    const districtConfigs = await this.districtConfigsRepository.find({
      where: {
        code: In(clan.ownedDistricts),
        isActive: true,
      },
    });

    // Маппим коды территорий на конфигурации
    return clan.ownedDistricts.map((districtCode) => {
      const config = districtConfigs.find(c => c.code === districtCode);
      return {
        code: districtCode,
        name: config?.name || districtCode,
        description: config?.description || null,
        baseIncomePerDay: config ? Number(config.baseIncomePerDay) : 0,
        metadata: config?.metadata || null,
      };
    });
  }

  async getAvailableTerritoriesForCapture(clanId: string): Promise<any[]> {
    const clan = await this.findOne(clanId);
    
    // Получаем все конфигурации строений (BuildingConfig) - общие для всех
    const allBuildingConfigs = await this.buildingConfigsRepository.find();
    
    // Для каждой конфигурации проверяем, можно ли захватить (есть ли игроки с таким строением)
    const result = await Promise.all(
      allBuildingConfigs.map(async (config) => {
        // Получаем все строения этого типа, которые не захвачены или захвачены другим кланом
        const availableBuildings = await this.buildingsRepository.find({
          where: [
            { type: config.type, capturedByClanId: null },
            { type: config.type, capturedByClanId: Not(clanId) },
          ],
        });
        
        // Подсчитываем потенциальный доход (20% от дохода всех доступных строений)
        const totalPotentialIncome = availableBuildings.reduce(
          (sum, b) => sum + Math.floor(Number(b.incomePerHour) * 0.2),
          0
        );
        
        return {
          id: config.id,
          type: config.type,
          name: config.name,
          icon: config.icon,
          image: config.image,
          baseIncomePerHour: Number(config.baseIncomePerHour),
          availableCount: availableBuildings.length,
          totalPotentialIncome,
        };
      })
    );
    
    // Фильтруем только те типы, у которых есть доступные строения
    return result.filter(item => item.availableCount > 0);
  }

  async canClanCaptureTerritory(clanId: string): Promise<{ canCapture: boolean; reason?: string; cooldownRemaining?: number }> {
    const clan = await this.findOne(clanId);
    
    if (!clan.lastTerritoryCaptureAt) {
      return { canCapture: true };
    }

    const daysSinceLastCapture = (Date.now() - new Date(clan.lastTerritoryCaptureAt).getTime()) / (1000 * 60 * 60 * 24);
    const CAPTURE_COOLDOWN_DAYS = 3;
    
    if (daysSinceLastCapture < CAPTURE_COOLDOWN_DAYS) {
      const remainingDays = Math.ceil(CAPTURE_COOLDOWN_DAYS - daysSinceLastCapture);
      return {
        canCapture: false,
        reason: 'cooldown',
        cooldownRemaining: remainingDays,
      };
    }

    return { canCapture: true };
  }

  /**
   * Захват района кланом (новая логика)
   */
  async captureDistrictForClan(userId: string, clanId: string, districtCode: string): Promise<void> {
    // Проверяем права на захват
    const canCapture = await this.canClanCaptureTerritory(clanId);
    if (!canCapture.canCapture) {
      throw new BadRequestException(
        canCapture.reason === 'cooldown'
          ? `Клан может захватывать территории раз в день. Осталось: ${canCapture.cooldownRemaining} дней`
          : 'Клан не может захватить территорию'
      );
    }

    // Используем CityService для захвата района
    await this.cityService.captureDistrict(clanId, districtCode);

    // Обновляем время последнего захвата
    const clan = await this.findOne(clanId);
    clan.lastTerritoryCaptureAt = new Date();
    await this.clansRepository.save(clan);
  }

  /**
   * @deprecated Используйте captureDistrictForClan вместо этого
   * Захват строения кланом (старая логика)
   */
  async captureTerritoryForClan(userId: string, clanId: string, buildingType: string): Promise<void> {
    // Проверяем права на захват
    const canCapture = await this.canClanCaptureTerritory(clanId);
    if (!canCapture.canCapture) {
      throw new BadRequestException(
        canCapture.reason === 'cooldown'
          ? `Клан может захватывать территории раз в день. Осталось: ${canCapture.cooldownRemaining} дней`
          : 'Клан не может захватить территорию'
      );
    }

    // Используем CityService для захвата (старая логика)
    await this.cityService.captureTerritory(clanId, buildingType);

    // Обновляем время последнего захвата
    const clan = await this.findOne(clanId);
    clan.lastTerritoryCaptureAt = new Date();
    await this.clansRepository.save(clan);
  }

  /**
   * Получить доступные районы для захвата
   */
  async getAvailableDistrictsForCapture(clanId: string) {
    return this.cityService.getAvailableDistrictsForCapture(clanId);
  }

  /**
   * Получить захваченные районы клана
   */
  async getClanDistricts(clanId: string) {
    return this.cityService.getClanDistricts(clanId);
  }

  /**
   * Получить данные о районах с захватами для клана (для фронтенда)
   */
  async getClanDistrictsData(clanId: string) {
    // Используем метод из CityService для получения данных о районах с захватами
    // Но нужно получить все районы, а не только захваченные
    const districts = await this.districtConfigsRepository.find({
      where: { isActive: true },
      order: { order: 'ASC' },
    });

    // Получаем захваты напрямую из репозитория
    const captures = await this.districtCapturesRepository.find({
      where: { capturedByClanId: clanId },
    });

    const allCaptures = await this.districtCapturesRepository.find({
      order: { capturedAt: 'DESC' },
    });

    const now = new Date();
    const activeCaptures = allCaptures.filter(
      (c) => !c.expiresAt || c.expiresAt > now,
    );

    return districts.map(district => {
      const myCapture = captures.find(c => c.districtCode === district.code);
      const activeCapture = activeCaptures.find(c => c.districtCode === district.code);
      const isCapturedByMyClan = myCapture && (!myCapture.expiresAt || myCapture.expiresAt > now);
      const isCapturedByOther = activeCapture && activeCapture.capturedByClanId !== clanId;

      return {
        id: district.id,
        code: district.code,
        name: district.name,
        description: district.description,
        icon: district.icon,
        image: district.image,
        requiredLevel: district.requiredLevel ?? 1,
        isUnlocked: true, // Для кланов все районы доступны
        capture: myCapture ? {
          capturedAt: myCapture.capturedAt,
          expiresAt: myCapture.expiresAt,
          totalIncomeCollected: Number(myCapture.totalIncomeCollected),
          lastIncomeCollection: myCapture.lastIncomeCollection,
          baseIncomePerDay: Number(district.baseIncomePerDay || 0),
        } : null,
        isCapturedByMyClan,
        isCapturedByOther,
        capturedBy: activeCapture?.capturedByClanId || null,
      };
    });
  }

  /**
   * Собрать доход с захваченного района
   */
  async collectDistrictIncome(clanId: string, districtCode: string) {
    return this.cityService.collectDistrictIncome(clanId, districtCode);
  }
}

