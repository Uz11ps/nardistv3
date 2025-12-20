import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clan } from './clan.entity';
import { ClanMember, ClanRole } from './clan-member.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ClansService {
  constructor(
    @InjectRepository(Clan)
    private clansRepository: Repository<Clan>,
    @InjectRepository(ClanMember)
    private membersRepository: Repository<ClanMember>,
    private usersService: UsersService,
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
      throw new BadRequestException('Лидер не может покинуть клан');
    }

    await this.membersRepository.remove(member);

    const clan = member.clan;
    clan.memberCount--;
    await this.clansRepository.save(clan);
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

    user.narCoin = BigInt(user.narCoin || 0) - BigInt(amount);
    await this.usersService['usersRepository'].save(user);

    member.contribution = (BigInt(member.contribution || 0) + BigInt(amount)).toString();
    await this.membersRepository.save(member);

    const clan = member.clan;
    clan.treasury = (BigInt(clan.treasury || 0) + BigInt(amount)).toString();
    await this.clansRepository.save(clan);
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

    return this.clansRepository.save(clan);
  }
}

