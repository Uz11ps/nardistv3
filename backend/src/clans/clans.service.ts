import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Clan } from './clan.entity';
import { ClanMember, ClanRole } from './clan-member.entity';
import { ClanTreasuryTransaction, TreasuryTransactionType } from './clan-treasury-transaction.entity';
import { UsersService } from '../users/users.service';
import { DistrictConfig } from '../city/district-config.entity';
import { DistrictCapture } from '../city/district-capture.entity';
import { Building } from '../city/building.entity';
import { BuildingConfig } from '../city/building-config.entity';
import { PlayerCapture } from './player-capture.entity';
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
    @InjectRepository(PlayerCapture)
    private playerCapturesRepository: Repository<PlayerCapture>,
    private usersService: UsersService,
    @Inject(forwardRef(() => CityService))
    private cityService: CityService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Рассчитать уровень клана на основе суммы улучшений
   * Всего улучшений: 4 (clanLevel, districtStrength, economy, fortLevel)
   * Максимальный уровень каждого: 10
   * Максимальная сумма: 40
   * Формула: level = Math.min(10, Math.floor(sumOfUpgrades / 4))
   * Уровень клана - это просто визуальное значение, не влияет на функциональность
   */
  private calculateClanLevel(clan: Clan): number {
    const sumOfUpgrades = (clan.clanLevel || 1) + (clan.districtStrength || 1) + (clan.economy || 1) + (clan.fortLevel || 1);
    return Math.min(10, Math.floor(sumOfUpgrades / 4));
  }

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
      maxMembers: 5,
      clanLevel: 1, // Дефолтный уровень улучшения
      districtStrength: 1, // Дефолтный уровень улучшения
      economy: 1, // Дефолтный уровень улучшения
      fortLevel: 1, // Дефолтный уровень улучшения
    });

    // Рассчитываем уровень клана на основе суммы улучшений
    clan.level = this.calculateClanLevel(clan);

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
    
    // Улучшение "level" больше не существует, уровень рассчитывается автоматически
    if (upgradeType === 'level') {
      throw new BadRequestException('Уровень клана рассчитывается автоматически на основе суммы улучшений');
    }

    const costs: Record<string, number> = {
      districtStrength: (clan.districtStrength || 1) * 500,
      economy: (clan.economy || 1) * 800,
      fort: (clan.fortLevel || 1) * 1200,
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
      districtStrength: 'Сила районов',
      economy: 'Экономика',
      fort: 'Форт клана',
      maxMembers: 'Максимум участников',
    };
    const upgradeName = upgradeNames[upgradeType] || 'Улучшение';

    switch (upgradeType) {
      case 'districtStrength':
        if ((clan.districtStrength || 1) >= 10) {
          throw new BadRequestException('Сила районов достигла максимального уровня');
        }
        clan.districtStrength = (clan.districtStrength || 1) + 1;
        break;
      case 'economy':
        if ((clan.economy || 1) >= 10) {
          throw new BadRequestException('Экономика достигла максимального уровня');
        }
        clan.economy = (clan.economy || 1) + 1;
        // Убираем weeklyIncome - он не используется
        break;
      case 'fort':
        if ((clan.fortLevel || 1) >= 10) {
          throw new BadRequestException('Форт достиг максимального уровня');
        }
        clan.fortLevel = (clan.fortLevel || 1) + 1;
        // Форт не дает реальных эффектов, только для визуала
        break;
      case 'maxMembers':
        const currentMaxMembers = clan.maxMembers || 5;
        // Базовое количество: 5 (уровень 1), максимум уровней улучшения: 10, каждый уровень дает +5
        // Максимум участников: 5 + 9 * 5 = 50
        const maxMembersLevel = Math.floor((currentMaxMembers - 5) / 5) + 1; // Уровень от 1 до 10
        if (maxMembersLevel >= 10 || currentMaxMembers >= 50) {
          throw new BadRequestException('Максимум участников достиг максимального значения (50)');
        }
        clan.maxMembers = Math.min(currentMaxMembers + 5, 50);
        break;
    }

    // Пересчитываем уровень клана на основе суммы улучшений (только для визуала)
    clan.level = this.calculateClanLevel(clan);

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
    districtStrength: { current: number; max: number; cost: number };
    economy: { current: number; max: number; cost: number };
    fort: { current: number; max: number; cost: number };
    maxMembers: { current: number; max: number; cost: number };
    clanLevel: number; // Общий уровень клана (рассчитывается автоматически, только для визуала)
  }> {
    const clan = await this.clansRepository.findOne({ where: { id: clanId } });
    if (!clan) {
      throw new NotFoundException('Клан не найден');
    }

    const districtStrength = clan.districtStrength || 1;
    const economy = clan.economy || 1;
    const fortLevel = clan.fortLevel || 1;
    const maxMembers = clan.maxMembers || 5;

    return {
      districtStrength: {
        current: districtStrength,
        max: 10,
        cost: districtStrength >= 10 ? 0 : districtStrength * 500,
      },
      economy: {
        current: economy,
        max: 10,
        cost: economy >= 10 ? 0 : economy * 800,
      },
      fort: {
        current: fortLevel,
        max: 10,
        cost: fortLevel >= 10 ? 0 : fortLevel * 1200,
      },
      maxMembers: {
        current: maxMembers,
        max: 50, // Максимум участников
        // Рассчитываем уровень улучшения: базовое 10, каждый уровень +5
        cost: (() => {
          if (maxMembers >= 50) return 0;
          // Уровень улучшения (1-10, где 1 = базовое 5, 10 = максимум 50)
          const level = Math.floor((maxMembers - 5) / 5) + 1;
          return level * 1000;
        })(),
      },
      clanLevel: this.calculateClanLevel(clan), // Общий уровень клана (только для визуала)
    };
  }

  /**
   * Получить предварительную информацию об улучшении
   */
  async getUpgradePreview(clanId: string, upgradeType: string): Promise<{
    upgradeType: string;
    upgradeName: string;
    currentLevel: number;
    newLevel: number;
    cost: number;
    currentTreasury: number;
    newTreasury: number;
    effects: Array<{ label: string; current: string; new: string }>;
    currentClanLevel: number;
    newClanLevel: number;
  }> {
    const clan = await this.clansRepository.findOne({ where: { id: clanId } });
    if (!clan) {
      throw new NotFoundException('Клан не найден');
    }

    // Рассчитываем стоимость улучшения maxMembers на основе уровня улучшения
    const currentMaxMembers = clan.maxMembers || 5;
    const maxMembersLevel = Math.floor((currentMaxMembers - 5) / 5) + 1; // Уровень от 1 до 10
    const maxMembersCost = currentMaxMembers >= 50 ? 0 : maxMembersLevel * 1000;

    const costs: Record<string, number> = {
      districtStrength: (clan.districtStrength || 1) * 500,
      economy: (clan.economy || 1) * 800,
      fort: (clan.fortLevel || 1) * 1200,
      maxMembers: maxMembersCost,
    };

    const cost = costs[upgradeType];
    if (!cost) {
      throw new BadRequestException('Неверный тип улучшения');
    }

    const upgradeNames: Record<string, string> = {
      districtStrength: 'Сила районов',
      economy: 'Экономика',
      fort: 'Форт клана',
      maxMembers: 'Максимум участников',
    };
    const upgradeName = upgradeNames[upgradeType] || 'Улучшение';

    const currentTreasury = Number(clan.treasury || 0);
    const newTreasury = currentTreasury - cost;

    let currentLevel = 1;
    let newLevel = 1;
    const effects: Array<{ label: string; current: string; new: string }> = [];

    switch (upgradeType) {
      case 'districtStrength':
        currentLevel = clan.districtStrength || 1;
        newLevel = currentLevel + 1;
        effects.push({
          label: 'Сила районов',
          current: `${currentLevel}/10`,
          new: `${newLevel}/10`,
        });
        break;
      case 'economy':
        currentLevel = clan.economy || 1;
        newLevel = currentLevel + 1;
        // Каждый уровень экономики дает +10% к доходу от захватов
        const currentEconomyMultiplier = 1 + (currentLevel - 1) * 0.1;
        const newEconomyMultiplier = 1 + (newLevel - 1) * 0.1;
        const currentEconomyPercent = Math.round((currentEconomyMultiplier - 1) * 100);
        const newEconomyPercent = Math.round((newEconomyMultiplier - 1) * 100);
        effects.push({
          label: 'Экономика',
          current: `${currentLevel}/10`,
          new: `${newLevel}/10`,
        });
        effects.push({
          label: 'Доход от захватов',
          current: currentEconomyPercent === 0 ? 'Базовый' : `+${currentEconomyPercent}%`,
          new: `+${newEconomyPercent}%`,
        });
        break;
      case 'fort':
        currentLevel = clan.fortLevel || 1;
        newLevel = currentLevel + 1;
        effects.push({
          label: 'Форт федерации',
          current: `${currentLevel}/10`,
          new: `${newLevel}/10`,
        });
        // Форт не дает реальных эффектов, только для визуала
        break;
      case 'maxMembers':
        currentLevel = clan.maxMembers || 5;
        const currentMaxMembersLevel = Math.floor((currentLevel - 5) / 5) + 1; // Уровень от 1 до 10
        if (currentMaxMembersLevel >= 10 || currentLevel >= 50) {
          throw new BadRequestException('Максимум участников достиг максимального значения (50)');
        }
        newLevel = Math.min(currentLevel + 5, 50); // Не превышаем максимум 50
        effects.push({
          label: 'Максимум участников',
          current: `${currentLevel}`,
          new: `${newLevel}`,
        });
        break;
    }

    // Рассчитываем текущий и новый уровень клана (только для визуала)
    const currentClanLevel = this.calculateClanLevel(clan);
    
    // Создаем временный объект для расчета нового уровня
    const tempClan = { ...clan };
    switch (upgradeType) {
      case 'districtStrength':
        tempClan.districtStrength = newLevel;
        break;
      case 'economy':
        tempClan.economy = newLevel;
        break;
      case 'fort':
        tempClan.fortLevel = newLevel;
        break;
      case 'maxMembers':
        tempClan.maxMembers = newLevel;
        break;
    }
    const newClanLevel = this.calculateClanLevel(tempClan);

    // Показываем изменение уровня федерации только если он изменился (только для визуала)
    // Уровень федерации не влияет на функциональность, только для отображения
    if (currentClanLevel !== newClanLevel && upgradeType !== 'maxMembers') {
      effects.push({
        label: 'Уровень федерации',
        current: `${currentClanLevel}/10`,
        new: `${newClanLevel}/10`,
      });
    }

    return {
      upgradeType,
      upgradeName,
      currentLevel,
      newLevel,
      cost,
      currentTreasury,
      newTreasury,
      effects,
      currentClanLevel,
      newClanLevel,
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

    const hoursSinceLastCapture = (Date.now() - new Date(clan.lastTerritoryCaptureAt).getTime()) / (1000 * 60 * 60);
    const CAPTURE_COOLDOWN_HOURS = 24;
    
    if (hoursSinceLastCapture < CAPTURE_COOLDOWN_HOURS) {
      const remainingHours = Math.ceil(CAPTURE_COOLDOWN_HOURS - hoursSinceLastCapture);
      return {
        canCapture: false,
        reason: 'cooldown',
        cooldownRemaining: remainingHours,
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
          ? `Клан может захватывать территории раз в 24 часа. Осталось: ${canCapture.cooldownRemaining} часов`
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
          ? `Клан может захватывать территории раз в 24 часа. Осталось: ${canCapture.cooldownRemaining} часов`
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

    // Получаем клан для расчета множителя экономики
    const clan = await this.clansRepository.findOne({ where: { id: clanId } });
    const economyLevel = clan?.economy || 1;
    // Каждый уровень экономики дает +10% к доходу от захватов
    const economyMultiplier = 1 + (economyLevel - 1) * 0.1;

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

      // Рассчитываем доход с учетом экономики (только для захваченных районов)
      const baseIncomePerDay = Number(district.baseIncomePerDay || 0);
      const incomePerDayWithEconomy = myCapture ? Math.floor(baseIncomePerDay * economyMultiplier) : baseIncomePerDay;

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
          baseIncomePerDay: incomePerDayWithEconomy, // Показываем доход с учетом экономики
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

  /**
   * Проверяет, есть ли у клана активный захват района
   */
  async hasActiveDistrictCapture(clanId: string, districtCode: string): Promise<boolean> {
    const capture = await this.districtCapturesRepository.findOne({
      where: {
        capturedByClanId: clanId,
        districtCode,
      },
      order: { capturedAt: 'DESC' },
    });

    if (!capture) {
      return false;
    }

    // Проверяем, не истек ли срок захвата
    if (capture.expiresAt && capture.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Получает информацию об активном захвате района кланом
   */
  async getActiveDistrictCapture(clanId: string): Promise<DistrictCapture | null> {
    const captures = await this.districtCapturesRepository.find({
      where: {
        capturedByClanId: clanId,
      },
      order: { capturedAt: 'DESC' },
    });

    const now = new Date();
    for (const capture of captures) {
      if (!capture.expiresAt || capture.expiresAt > now) {
        return capture;
      }
    }

    return null;
  }

  /**
   * Проверяет, есть ли у участника клана активный захват района
   */
  async hasActiveCaptureForMember(userId: string): Promise<{ hasCapture: boolean; districtCode?: string; clanName?: string }> {
    const userClan = await this.getUserClan(userId);
    if (!userClan || !userClan.clan) {
      return { hasCapture: false };
    }

    const activeCapture = await this.getActiveDistrictCapture(userClan.clan.id);
    if (!activeCapture) {
      return { hasCapture: false };
    }

    return {
      hasCapture: true,
      districtCode: activeCapture.districtCode,
      clanName: userClan.clan.name,
    };
  }

  /**
   * Накладывает захват на игрока (действует 1 час)
   */
  async capturePlayer(playerId: string, capturingClanId: string, districtCode: string): Promise<PlayerCapture> {
    // Удаляем старые захваты на этого игрока от этого клана
    await this.playerCapturesRepository.delete({
      playerId,
      capturingClanId,
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 час

    const capture = this.playerCapturesRepository.create({
      playerId,
      capturingClanId,
      districtCode,
      capturedAt: now,
      expiresAt,
    });

    return await this.playerCapturesRepository.save(capture);
  }

  /**
   * Получает случайного игрока с купленным районом
   */
  async getRandomPlayerWithDistrict(districtCode: string): Promise<string | null> {
    // Находим DistrictConfig по code, чтобы получить id
    const districtConfig = await this.districtConfigsRepository.findOne({
      where: { code: districtCode },
    });

    if (!districtConfig) {
      return null;
    }

    // Находим всех игроков, у которых есть строения в этом районе
    const buildings = await this.buildingsRepository.find();

    // Фильтруем строения по району через BuildingConfig
    const buildingConfigs = await this.buildingConfigsRepository.find();
    const districtBuildings = buildings.filter(building => {
      const config = buildingConfigs.find(c => c.type === building.type);
      return config && config.districtId === districtConfig.id;
    });

    if (districtBuildings.length === 0) {
      return null;
    }

    // Выбираем случайного игрока
    const randomIndex = Math.floor(Math.random() * districtBuildings.length);
    return districtBuildings[randomIndex].userId;
  }

  /**
   * Обрабатывает победу участника клана - накладывает захват на проигравшего и передает доход клану
   */
  async processClanMemberWin(winnerId: string, loserId: string, districtCode: string): Promise<void> {
    // Проверяем, состоит ли победитель в клане
    const winnerClan = await this.getUserClan(winnerId);
    if (!winnerClan || !winnerClan.clan) {
      return; // Победитель не в клане
    }

    const clanId = winnerClan.clan.id;

    // Проверяем, есть ли у клана активный захват этого района
    const hasActiveCapture = await this.hasActiveDistrictCapture(clanId, districtCode);
    if (!hasActiveCapture) {
      return; // У клана нет активного захвата этого района
    }

    // Проверяем, есть ли у проигравшего город (buildings)
    const loserBuildings = await this.buildingsRepository.find({
      where: { userId: loserId },
    });

    let targetPlayerId: string | null = null;

    if (loserBuildings.length > 0) {
      // У проигравшего есть город - накладываем захват на него
      targetPlayerId = loserId;
    } else {
      // У проигравшего нет города - выбираем случайного игрока с этим районом
      targetPlayerId = await this.getRandomPlayerWithDistrict(districtCode);
      if (!targetPlayerId) {
        this.logger.warn(`Не найден игрок с районом ${districtCode} для захвата`);
        return;
      }
    }

    // Накладываем захват на игрока (1 час)
    await this.capturePlayer(targetPlayerId, clanId, districtCode);

    // Вычисляем доход от игрока (базовый доход от его строений)
    const targetBuildings = await this.buildingsRepository.find({
      where: { userId: targetPlayerId },
    });

    // Находим DistrictConfig по code, чтобы получить id
    const districtConfig = await this.districtConfigsRepository.findOne({
      where: { code: districtCode },
    });

    if (!districtConfig) {
      this.logger.warn(`Район ${districtCode} не найден`);
      return;
    }

    let incomeToTransfer = 0;
    for (const building of targetBuildings) {
      // Получаем конфиг строения
      const config = await this.buildingConfigsRepository.findOne({
        where: { type: building.type },
      });

      if (config && config.districtId === districtConfig.id) {
        // Берем 50% дохода за час (incomePerHour)
        const buildingIncome = Number(building.incomePerHour || 0);
        incomeToTransfer += Math.floor(buildingIncome * 0.5);
      }
    }

    if (incomeToTransfer > 0) {
      // Передаем доход в казну клана
      const clan = await this.findOne(clanId);
      const currentTreasury = Number(clan.treasury || 0);
      clan.treasury = (currentTreasury + incomeToTransfer).toString();
      await this.clansRepository.save(clan);

      // Списываем доход у игрока
      const targetUser = await this.usersService.findOne(targetPlayerId);
      const currentBalance = Number(targetUser.narCoin || 0);
      const newBalance = Math.max(0, currentBalance - incomeToTransfer);
      await this.usersService.update(targetPlayerId, { narCoin: newBalance });

      // Создаем транзакцию в казне
      const transaction = this.transactionsRepository.create({
        clanId: clanId,
        userId: winnerId, // Победитель, который принес доход
        type: TreasuryTransactionType.INCOME,
        amount: incomeToTransfer.toString(),
        description: `Доход от захвата игрока ${targetUser.username} (район ${districtCode})`,
      });
      await this.transactionsRepository.save(transaction);

      this.logger.log(`💰 Клан ${clanId} получил ${incomeToTransfer} NAR от захвата игрока ${targetPlayerId}`);
    }
  }
}

