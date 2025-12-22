import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Clan } from './clan.entity';
import { ClanMember, ClanRole } from './clan-member.entity';
import { ClanTreasuryTransaction, TreasuryTransactionType } from './clan-treasury-transaction.entity';
import { UsersService } from '../users/users.service';
import { DistrictConfig } from '../city/district-config.entity';
import { Building } from '../city/building.entity';
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
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
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
    if (user.level < 20) {
      throw new BadRequestException('Кланы доступны с 20 уровня');
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
    if (user.level < 20) {
      throw new BadRequestException('Кланы доступны с 20 уровня');
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

    // Освобождаем все захваченные территории
    if (clan.ownedDistricts && clan.ownedDistricts.length > 0) {
      try {
        // Находим все здания, захваченные этим кланом
        const capturedBuildings = await this.buildingsRepository.find({
          where: { capturedByClanId: clanId },
        });

        // Освобождаем все здания
        for (const building of capturedBuildings) {
          building.capturedByClanId = null;
          building.capturedAt = null;
          await this.buildingsRepository.save(building);
        }

        this.logger.log(`✅ Освобождено ${capturedBuildings.length} захваченных территорий`);
      } catch (error) {
        this.logger.error(`❌ Ошибка при освобождении территорий: ${error.message}`, error.stack);
      }
    }

    // Отправляем уведомления всем участникам
    const notificationMessage = `Клан "${clan.name}" был распущен лидером. Вы больше не состоите в клане.`;
    
    for (const member of members) {
      try {
        await this.notificationsService.createNotification(
          member.userId,
          'Клан распущен',
          notificationMessage,
          'clan_disbanded',
        );
      } catch (error) {
        this.logger.error(`❌ Ошибка при отправке уведомления участнику ${member.userId}: ${error.message}`);
      }
    }

    // Удаляем всех участников
    await this.membersRepository.delete({ clanId });

    // Удаляем все транзакции казны
    await this.transactionsRepository.delete({ clanId });

    // Удаляем клан
    await this.clansRepository.remove(clan);

    this.logger.log(`✅ Клан ${clan.name} успешно распущен. Удалено участников: ${members.length}`);
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
    
    // Получаем все активные территории
    const allDistricts = await this.districtConfigsRepository.find({
      where: { isActive: true },
      order: { order: 'ASC' },
    });

    // Получаем все предприятия
    const allBuildings = await this.buildingsRepository.find();

    // Для каждой территории находим предприятия, которые можно захватить
    const result = [];
    for (const district of allDistricts) {
      const districtBuildings = allBuildings.filter(b => b.district === district.code);
      
      // Фильтруем: исключаем предприятия, которые уже захвачены этим кланом
      const captureableBuildings = districtBuildings.filter(b => {
        // Исключаем уже захваченные этим кланом
        if (b.capturedByClanId === clanId) {
          return false;
        }
        return true;
      });

      if (captureableBuildings.length > 0) {
        result.push({
          district: {
            code: district.code,
            name: district.name,
            description: district.description,
            order: district.order,
          },
          buildings: captureableBuildings.map(b => ({
            id: b.id,
            type: b.type,
            level: b.level,
            incomePerHour: Number(b.incomePerHour),
            ownerId: b.userId,
            capturedByClanId: b.capturedByClanId,
            capturedAt: b.capturedAt,
          })),
          totalIncome: captureableBuildings.reduce((sum, b) => sum + Number(b.incomePerHour), 0),
        });
      }
    }

    return result;
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

  async captureTerritoryForClan(userId: string, clanId: string, buildingId: string): Promise<void> {
    // Используем CityService для захвата
    await this.cityService.captureTerritory(userId, buildingId);
  }
}

