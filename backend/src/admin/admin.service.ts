import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { AcademyService } from '../academy/academy.service';
import { SkinsService } from '../skins/skins.service';
import { GamesService } from '../games/games.service';
import { QuestsService } from '../quests/quests.service';
import { ClansService } from '../clans/clans.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { Subscription, SubscriptionPlan } from '../subscription/subscription.entity';
import { User } from '../users/user.entity';
import { Game, GameMode, GameType, GameStatus } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { Article } from '../academy/article.entity';
import { Skin } from '../skins/skin.entity';
import { UserSkin } from '../skins/user-skin.entity';
import { Quest, QuestType, QuestTarget } from '../quests/quest.entity';
import { Clan } from '../clans/clan.entity';
import { ClanMember } from '../clans/clan-member.entity';
import { BuildingConfig } from '../city/building-config.entity';
import { DistrictConfig } from '../city/district-config.entity';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { NotificationsService } from '../notifications/notifications.service';
import { Rating } from '../ratings/rating.entity';
import { Notification } from '../notifications/notification.entity';
import { UserMaterial } from '../academy/user-material.entity';
import { NotificationTemplate, NotificationTemplateType } from './notification-template.entity';
import { SystemSettings } from './system-settings.entity';

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameMove)
    private movesRepository: Repository<GameMove>,
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Article)
    private articlesRepository: Repository<Article>,
    @InjectRepository(Skin)
    private skinsRepository: Repository<Skin>,
    @InjectRepository(UserSkin)
    private userSkinsRepository: Repository<UserSkin>,
    @InjectRepository(Quest)
    private questsRepository: Repository<Quest>,
    @InjectRepository(Clan)
    private clansRepository: Repository<Clan>,
    @InjectRepository(ClanMember)
    private clanMembersRepository: Repository<ClanMember>,
    @InjectRepository(Subscription)
    private subscriptionsRepository: Repository<Subscription>,
    @InjectRepository(BuildingConfig)
    private buildingConfigsRepository: Repository<BuildingConfig>,
    @InjectRepository(DistrictConfig)
    private districtConfigsRepository: Repository<DistrictConfig>,
    @InjectRepository(Rating)
    private ratingsRepository: Repository<Rating>,
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(UserMaterial)
    private userMaterialsRepository: Repository<UserMaterial>,
    @InjectRepository(SystemSettings)
    private systemSettingsRepository: Repository<SystemSettings>,
    @InjectRepository(NotificationTemplate)
    private notificationTemplatesRepository: Repository<NotificationTemplate>,
    private usersService: UsersService,
    private tournamentsService: TournamentsService,
    @Inject(forwardRef(() => AcademyService))
    private academyService: AcademyService,
    private skinsService: SkinsService,
    private gamesService: GamesService,
    private questsService: QuestsService,
    private clansService: ClansService,
    private subscriptionService: SubscriptionService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async getStats() {
    const totalUsers = await this.usersRepository.count();
    const activeUsers = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.updatedAt > :date', { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
      .getCount();
    
    const totalGames = await this.gamesRepository.count();
    const finishedGames = await this.gamesRepository.count({ where: { status: GameStatus.FINISHED } });
    const inProgressGames = await this.gamesRepository.count({ where: { status: GameStatus.IN_PROGRESS } });
    
    const totalMoves = await this.movesRepository.count();
    
    const bannedUsers = await this.usersRepository.count({ where: { isBanned: true } });
    const adminUsers = await this.usersRepository.count({ where: { isAdmin: true } });
    
    const totalNarCoin = await this.usersRepository
      .createQueryBuilder('user')
      .select('SUM(user.narCoin)', 'total')
      .getRawOne();
    
    const totalXp = await this.usersRepository
      .createQueryBuilder('user')
      .select('SUM(user.xp)', 'total')
      .getRawOne();

    // Статистика по уровням
    const levelStats = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.level', 'level')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.level')
      .orderBy('user.level', 'ASC')
      .getRawMany();

    // Статистика по играм за последние 7 дней
    const gamesLast7Days = await this.gamesRepository
      .createQueryBuilder('game')
      .where('game.createdAt > :date', { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
      .select('DATE(game.createdAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .groupBy('DATE(game.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        admins: adminUsers,
        levelDistribution: levelStats,
      },
      games: {
        total: totalGames,
        finished: finishedGames,
        inProgress: inProgressGames,
        totalMoves,
        last7Days: gamesLast7Days,
      },
      economy: {
        totalNarCoin: totalNarCoin?.total || '0',
        totalXp: totalXp?.total || '0',
      },
    };
  }

  async getAllUsers() {
    return this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getUserDetails(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    const userGames = await this.gamesRepository.find({
      where: [
        { player1Id: id },
        { player2Id: id },
      ],
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const wins = await this.gamesRepository.count({
      where: [
        { player1Id: id, winnerId: id },
        { player2Id: id, winnerId: id },
      ],
    });

    return {
      ...user,
      games: userGames,
      stats: {
        totalGames: userGames.length,
        wins,
        losses: userGames.length - wins,
      },
    };
  }

  async getAllGames() {
    return this.gamesRepository.find({
      relations: ['player1', 'player2'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getGameDetails(id: string) {
    const game = await this.gamesRepository.findOne({
      where: { id },
      relations: ['player1', 'player2'],
    });
    
    if (!game) {
      throw new Error('Игра не найдена');
    }

    const moves = await this.movesRepository.find({
      where: { gameId: id },
      order: { moveNumber: 'ASC' },
    });

    return {
      ...game,
      moves,
    };
  }

  async banUser(userId: string, reason: string) {
    return this.usersService.banUser(userId, reason);
  }

  async unbanUser(userId: string) {
    return this.usersService.unbanUser(userId);
  }

  async deleteUser(userId: string) {
    try {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Пользователь не найден');
      }

      // Нельзя удалить админа
      if (user.isAdmin) {
        throw new BadRequestException('Нельзя удалить администратора');
      }

      // Удаляем все связанные данные пользователя
      // Удаляем игры, где пользователь был игроком (каскадное удаление через БД)
      const userGames = await this.gamesRepository.find({
        where: [
          { player1Id: userId },
          { player2Id: userId },
        ],
        select: ['id'],
      });
      
      if (userGames.length > 0) {
        const gameIds = userGames.map(g => g.id);
        // Удаляем ходы через QueryBuilder
        await this.movesRepository
          .createQueryBuilder()
          .delete()
          .where('gameId IN (:...gameIds)', { gameIds })
          .execute();
        
        // Удаляем игры
        await this.gamesRepository
          .createQueryBuilder()
          .delete()
          .where('id IN (:...gameIds)', { gameIds })
          .execute();
      }

      // Удаляем рейтинги пользователя
      try {
        await this.ratingsRepository.delete({ userId });
      } catch (error) {
        this.logger.warn(`Failed to delete ratings for user ${userId}:`, error);
      }

      // Удаляем уведомления пользователя
      try {
        await this.notificationsRepository.delete({ userId });
      } catch (error) {
        this.logger.warn(`Failed to delete notifications for user ${userId}:`, error);
      }

      // Удаляем материалы пользователя
      try {
        await this.userMaterialsRepository.delete({ userId });
      } catch (error) {
        this.logger.warn(`Failed to delete user materials for user ${userId}:`, error);
      }

      // Удаляем скины пользователя
      try {
        await this.userSkinsRepository.delete({ userId });
      } catch (error) {
        this.logger.warn(`Failed to delete user skins for user ${userId}:`, error);
      }

      // Удаляем членство в кланах
      await this.clanMembersRepository.delete({ userId });

      // Удаляем самого пользователя
      await this.usersRepository.remove(user);
      
      return { message: 'Пользователь удален', userId };
    } catch (error) {
      this.logger.error(`Error deleting user ${userId}:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при удалении пользователя: ${error.message}`);
    }
  }

  async sendNotification(data: { userId?: string; message: string; all?: boolean; imageUrl?: string }) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const title = 'Уведомление от администратора';
    const message = data.message;
    const type = 'info' as const;

    if (data.all) {
      // Отправить всем пользователям
      const users = await this.usersRepository.find({
        where: { isBanned: false },
        select: ['id', 'telegramId'],
      });

      const userIds = users.map(u => u.id);
      
      // Сохраняем уведомления в БД
      await this.notificationsService.createNotificationForAllUsers(
        title,
        message,
        type,
        userIds,
        data.imageUrl,
      );

      // Отправляем через Telegram (если настроен)
      const results = [];
      if (botToken) {
        for (const user of users) {
          try {
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              chat_id: user.telegramId,
              text: message,
            });
            results.push({ userId: user.telegramId, status: 'sent' });
          } catch (error) {
            results.push({ userId: user.telegramId, status: 'error', error: error.message });
          }
        }
      }

      return { 
        sent: results.filter(r => r.status === 'sent').length, 
        total: users.length, 
        notificationsCreated: userIds.length,
        results 
      };
    } else if (data.userId) {
      // Отправить конкретному пользователю
      const user = await this.usersRepository.findOne({ where: { id: data.userId } });
      if (!user) {
        throw new Error('Пользователь не найден');
      }

      // Сохраняем уведомление в БД
      await this.notificationsService.createNotification(user.id, title, message, type, data.imageUrl);

      // Отправляем через Telegram (если настроен)
      if (botToken) {
        try {
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: user.telegramId,
            text: message,
          });
        } catch (error) {
          // Игнорируем ошибки Telegram, так как уведомление уже сохранено в БД
        }
      }

      return { success: true, userId: user.id };
    }

    throw new Error('Укажите userId или установите all=true');
  }

  async deleteNotification(notificationId: string) {
    try {
      await this.notificationsRepository.delete({ id: notificationId });
      return { message: 'Уведомление удалено', notificationId };
    } catch (error) {
      this.logger.error(`Error deleting notification ${notificationId}:`, error);
      throw new BadRequestException(`Ошибка при удалении уведомления: ${error.message}`);
    }
  }

  async deleteUserNotifications(userId: string) {
    try {
      await this.notificationsRepository.delete({ userId });
      return { message: 'Все уведомления пользователя удалены', userId };
    } catch (error) {
      this.logger.error(`Error deleting notifications for user ${userId}:`, error);
      throw new BadRequestException(`Ошибка при удалении уведомлений: ${error.message}`);
    }
  }

  async deleteAllNotifications() {
    try {
      const result = await this.notificationsRepository.delete({});
      return { message: 'Все уведомления удалены', deletedCount: result.affected || 0 };
    } catch (error) {
      this.logger.error('Error deleting all notifications:', error);
      throw new BadRequestException(`Ошибка при удалении всех уведомлений: ${error.message}`);
    }
  }

  async createGame(data: { player1Id: string; player2Id?: string; mode: string; type: string }) {
    try {
      // Проверяем существование игроков
      const player1 = await this.usersService.findOne(data.player1Id);
      if (!player1) {
        throw new NotFoundException('Игрок 1 не найден');
      }

      if (data.player2Id) {
        const player2 = await this.usersService.findOne(data.player2Id);
        if (!player2) {
          throw new NotFoundException('Игрок 2 не найден');
        }
      }

      return this.gamesService.create(
        data.player1Id,
        data.player2Id || null,
        data.mode as GameMode,
        data.type as GameType,
      );
    } catch (error) {
      this.logger.error(`Error creating game:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при создании игры: ${error.message}`);
    }
  }

  async createTournament(data: any) {
    try {
      this.logger.log(`Creating tournament with data: ${JSON.stringify(data)}`);
      return await this.tournamentsService.create(data);
    } catch (error) {
      this.logger.error(`Error creating tournament: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при создании турнира: ${error.message}`);
    }
  }

  async getAllTournaments() {
    const tournaments = await this.tournamentsRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['matches'],
    });
    
    // Преобразуем bigint в числа для корректной сериализации JSON
    return tournaments.map(t => ({
      ...t,
      entryFee: t.entryFee ? (typeof t.entryFee === 'string' ? Number(t.entryFee) : Number(t.entryFee)) : 0,
    }));
  }

  async getTournament(id: string) {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id },
      relations: ['matches'],
    });
    
    if (!tournament) {
      throw new NotFoundException('Турнир не найден');
    }
    
    return {
      ...tournament,
      entryFee: tournament.entryFee ? (typeof tournament.entryFee === 'string' ? Number(tournament.entryFee) : Number(tournament.entryFee)) : 0,
    };
  }

  async updateTournament(id: string, data: Partial<Tournament>) {
    const tournament = await this.tournamentsRepository.findOne({ where: { id } });
    if (!tournament) {
      throw new NotFoundException('Турнир не найден');
    }
    
    // Преобразуем entryFee обратно в bigint если пришло как number
    if (data.entryFee !== undefined && typeof data.entryFee === 'number') {
      (data as any).entryFee = data.entryFee.toString();
    }
    
    Object.assign(tournament, data);
    return this.tournamentsRepository.save(tournament);
  }

  async deleteTournament(id: string) {
    const tournament = await this.tournamentsRepository.findOne({ where: { id } });
    if (!tournament) {
      throw new NotFoundException('Турнир не найден');
    }
    
    await this.tournamentsRepository.remove(tournament);
    return { message: 'Турнир удален' };
  }

  async createArticle(data: any) {
    // Если это курс от админа, устанавливаем authorId в null и isVerified в true
    if (data.type === 'course') {
      data.authorId = null; // null означает, что это курс от админа
      data.isVerified = true; // Курсы от админов сразу верифицированы
    }
    return this.academyService.create(data);
  }

  async getAllArticles() {
    return this.academyService.findAll();
  }

  async updateArticle(id: string, data: any) {
    return this.academyService.update(id, data);
  }

  async deleteArticle(id: string) {
    return this.academyService.delete(id);
  }

  async getCityRewards() {
    const configs = await this.buildingConfigsRepository
      .createQueryBuilder('config')
      .orderBy('config.district', 'ASC')
      .addOrderBy('config.type', 'ASC')
      .getMany();

    return {
      buildings: configs.map(c => ({
        id: c.id,
        district: c.district,
        type: c.type,
        basePrice: Number(c.basePrice),
        baseIncomePerHour: Number(c.baseIncomePerHour),
        maxAccumulation: Number(c.maxAccumulation),
        maxLevel: c.maxLevel,
        upgradeCosts: c.upgradeCosts,
      })),
    };
  }

  async updateCityRewards(data: any) {
    if (data.buildings && Array.isArray(data.buildings)) {
      for (const buildingData of data.buildings) {
        if (buildingData.id) {
          // Обновляем существующую конфигурацию
          const config = await this.buildingConfigsRepository.findOne({ where: { id: buildingData.id } });
          if (config) {
            Object.assign(config, {
              basePrice: buildingData.basePrice?.toString() || config.basePrice,
              baseIncomePerHour: buildingData.baseIncomePerHour?.toString() || config.baseIncomePerHour,
              maxAccumulation: buildingData.maxAccumulation?.toString() || config.maxAccumulation,
              maxLevel: buildingData.maxLevel || config.maxLevel,
              upgradeCosts: buildingData.upgradeCosts || config.upgradeCosts,
            });
            await this.buildingConfigsRepository.save(config);
          }
        } else {
          // Создаем новую конфигурацию
          const config = this.buildingConfigsRepository.create({
            district: buildingData.district,
            type: buildingData.type,
            basePrice: buildingData.basePrice?.toString() || '0',
            baseIncomePerHour: buildingData.baseIncomePerHour?.toString() || '0',
            maxAccumulation: buildingData.maxAccumulation?.toString() || '0',
            maxLevel: buildingData.maxLevel || 10,
            upgradeCosts: buildingData.upgradeCosts || {},
          });
          await this.buildingConfigsRepository.save(config);
        }
      }
    }

    return this.getCityRewards();
  }

  // CRUD для территорий (районов)
  async getAllDistricts() {
    const districts = await this.districtConfigsRepository.find({
      order: { order: 'ASC' },
    });
    
    // Преобразуем bigint в числа для корректной сериализации JSON
    return districts.map(d => ({
      ...d,
      baseIncomePerDay: d.baseIncomePerDay ? (typeof d.baseIncomePerDay === 'string' ? Number(d.baseIncomePerDay) : Number(d.baseIncomePerDay)) : 0,
    }));
  }

  async getDistrict(id: string) {
    const district = await this.districtConfigsRepository.findOne({ where: { id } });
    if (!district) {
      throw new NotFoundException('Территория не найдена');
    }
    
    // Преобразуем bigint в число для корректной сериализации JSON
    return {
      ...district,
      baseIncomePerDay: district.baseIncomePerDay ? (typeof district.baseIncomePerDay === 'string' ? Number(district.baseIncomePerDay) : Number(district.baseIncomePerDay)) : 0,
    };
  }

  async createDistrict(data: {
    requiredLevel?: number;
    code: string;
    name: string;
    description?: string;
    order?: number;
    isActive?: boolean;
    baseIncomePerDay?: number;
    metadata?: any;
  }) {
    // Проверяем уникальность кода
    const existing = await this.districtConfigsRepository.findOne({ where: { code: data.code } });
    if (existing) {
      throw new BadRequestException(`Территория с кодом "${data.code}" уже существует`);
    }

    const district = this.districtConfigsRepository.create({
      code: data.code,
      name: data.name,
      description: data.description || null,
      order: data.order || 1,
      isActive: data.isActive !== undefined ? data.isActive : true,
      baseIncomePerDay: (data.baseIncomePerDay || 0).toString(),
      metadata: data.metadata || null,
      requiredLevel: data.requiredLevel || 1,
    });

    const savedDistrict = await this.districtConfigsRepository.save(district);
    
    // Преобразуем bigint в число для корректной сериализации JSON
    return {
      ...savedDistrict,
      baseIncomePerDay: savedDistrict.baseIncomePerDay ? (typeof savedDistrict.baseIncomePerDay === 'string' ? Number(savedDistrict.baseIncomePerDay) : Number(savedDistrict.baseIncomePerDay)) : 0,
    };
  }

  async updateDistrict(id: string, data: Partial<{
    code: string;
    name: string;
    description: string;
    order: number;
    isActive: boolean;
    baseIncomePerDay: number;
    metadata: any;
    requiredLevel: number;
  }>) {
    const district = await this.districtConfigsRepository.findOne({ where: { id } });
    if (!district) {
      throw new NotFoundException('Территория не найдена');
    }

    // Если меняется код, проверяем уникальность
    if (data.code && data.code !== district.code) {
      const existing = await this.districtConfigsRepository.findOne({ where: { code: data.code } });
      if (existing) {
        throw new BadRequestException(`Территория с кодом "${data.code}" уже существует`);
      }
    }

    Object.assign(district, {
      ...data,
      baseIncomePerDay: data.baseIncomePerDay !== undefined ? data.baseIncomePerDay.toString() : district.baseIncomePerDay,
      requiredLevel: data.requiredLevel !== undefined ? data.requiredLevel : district.requiredLevel,
    });

    const savedDistrict = await this.districtConfigsRepository.save(district);
    
    // Преобразуем bigint в число для корректной сериализации JSON
    return {
      ...savedDistrict,
      baseIncomePerDay: savedDistrict.baseIncomePerDay ? (typeof savedDistrict.baseIncomePerDay === 'string' ? Number(savedDistrict.baseIncomePerDay) : Number(savedDistrict.baseIncomePerDay)) : 0,
    };
  }

  async deleteDistrict(id: string) {
    const district = await this.districtConfigsRepository.findOne({ where: { id } });
    if (!district) {
      throw new NotFoundException('Территория не найдена');
    }

    // Проверяем, нет ли связанных предприятий
    const { Building } = await import('../city/building.entity');
    const buildingsRepository = this.usersRepository.manager.getRepository(Building);
    const buildingsCount = await buildingsRepository.count({
      where: { district: district.code as any },
    });

    if (buildingsCount > 0) {
      throw new BadRequestException(`Невозможно удалить территорию: есть ${buildingsCount} связанных предприятий`);
    }

    await this.districtConfigsRepository.remove(district);
    return { message: 'Территория удалена' };
  }

  // CRUD для скинов
  async getAllSkins() {
    return this.skinsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getSkin(id: string) {
    return this.skinsRepository.findOne({ where: { id } });
  }

  async createSkin(data: {
    name: string;
    description?: string;
    type: string;
    theme: string;
    boardConfig?: any;
    diceConfig?: any;
    checkersConfig?: any;
    isDefault?: boolean;
    isPremium?: boolean;
    weight?: number;
    imageUrl?: string;
    boardTextureUrl?: string;
    diceTextureUrl?: string;
    checkersTextureUrl?: string;
    whiteCheckersTextureUrl?: string;
    blackCheckersTextureUrl?: string;
    price?: number;
    rarity?: string;
    maxDurability?: number;
    xpBonusPercent?: number;
    moneyBonusPercent?: number;
  }) {
    const skin = this.skinsRepository.create({
      name: data.name,
      description: data.description || null,
      type: data.type || 'board',
      theme: data.theme,
      boardConfig: data.boardConfig || null,
      diceConfig: data.diceConfig || null,
      checkersConfig: data.checkersConfig || null,
      isDefault: data.isDefault || false,
      isPremium: data.isPremium || false,
      weight: data.weight || 1,
      imageUrl: data.imageUrl || null,
      boardTextureUrl: data.boardTextureUrl || null,
      diceTextureUrl: data.diceTextureUrl || null,
      checkersTextureUrl: data.checkersTextureUrl || null,
      whiteCheckersTextureUrl: data.whiteCheckersTextureUrl || null,
      blackCheckersTextureUrl: data.blackCheckersTextureUrl || null,
      price: data.price || null,
      rarity: data.rarity || 'common',
      maxDurability: data.maxDurability || 100,
      xpBonusPercent: data.xpBonusPercent || 0,
      moneyBonusPercent: data.moneyBonusPercent || 0,
    });

    return this.skinsRepository.save(skin);
  }

  async updateSkin(id: string, data: Partial<{
    name: string;
    description: string;
    type: string;
    theme: string;
    boardConfig: any;
    diceConfig: any;
    checkersConfig: any;
    isDefault: boolean;
    isPremium: boolean;
    weight: number;
    imageUrl: string;
    boardTextureUrl: string;
    diceTextureUrl: string;
    checkersTextureUrl: string;
    whiteCheckersTextureUrl: string;
    blackCheckersTextureUrl: string;
    price: number;
    rarity: string;
  }>) {
    const skin = await this.skinsRepository.findOne({ where: { id } });
    if (!skin) {
      throw new Error('Скин не найден');
    }

    Object.assign(skin, data);
    return this.skinsRepository.save(skin);
  }

  async deleteSkin(id: string) {
    const skin = await this.skinsRepository.findOne({ where: { id } });
    if (!skin) {
      throw new NotFoundException('Скин не найден');
    }

    try {
      // Удаляем файл изображения с сервера, если он есть
      if (skin.imageUrl) {
        try {
          // imageUrl хранится как /uploads/skins/filename.jpg
          const filename = skin.imageUrl.split('/').pop();
          if (filename) {
            const filePath = join(process.cwd(), 'uploads', 'skins', filename);
            await unlink(filePath).catch((err) => {
              // Игнорируем ошибку если файл уже удален
              console.warn(`File ${filePath} not found or already deleted:`, err.message);
            });
          }
        } catch (fileError) {
          // Логируем, но не прерываем удаление скина
          console.warn('Error deleting skin image file:', fileError);
        }
      }

      // Удаляем связанные записи user_skins сначала
      await this.userSkinsRepository.delete({ skinId: id });
      
      // Теперь удаляем сам скин
      await this.skinsRepository.remove(skin);
      return { message: 'Скин удален' };
    } catch (error: any) {
      console.error('Ошибка при удалении скина:', error);
      throw new BadRequestException('Не удалось удалить скин: ' + (error.message || 'неизвестная ошибка'));
    }
  }

  async updateSkinImage(id: string, imageUrl: string) {
    const skin = await this.skinsRepository.findOne({ where: { id } });
    if (!skin) {
      throw new Error('Скин не найден');
    }

    // Удаляем старое изображение, если оно было
    if (skin.imageUrl && skin.imageUrl !== imageUrl) {
      try {
        const oldFilename = skin.imageUrl.split('/').pop();
        if (oldFilename) {
          const oldFilePath = join(process.cwd(), 'uploads', 'skins', oldFilename);
          await unlink(oldFilePath).catch((err) => {
            // Игнорируем ошибку если файл уже удален
            console.warn(`Old file ${oldFilePath} not found:`, err.message);
          });
        }
      } catch (fileError) {
        console.warn('Error deleting old skin image file:', fileError);
      }
    }

    skin.imageUrl = imageUrl;
    return this.skinsRepository.save(skin);
  }

  // CRUD для квестов
  async getAllQuests() {
    try {
      const quests = await this.questsRepository.find({
        order: { createdAt: 'DESC' },
      });
      
      // Преобразуем bigint в числа для корректной сериализации JSON
      return quests.map(quest => ({
        ...quest,
        rewardNarCoin: quest.rewardNarCoin ? (typeof quest.rewardNarCoin === 'string' ? Number(quest.rewardNarCoin) : Number(quest.rewardNarCoin)) : 0,
      }));
    } catch (error) {
      this.logger.error(`Ошибка при получении квестов: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getQuest(id: string) {
    const quest = await this.questsRepository.findOne({ where: { id } });
    if (!quest) {
      throw new Error('Квест не найден');
    }
    // Преобразуем bigint в число для корректной сериализации JSON
    return {
      ...quest,
      rewardNarCoin: quest.rewardNarCoin ? (typeof quest.rewardNarCoin === 'string' ? Number(quest.rewardNarCoin) : Number(quest.rewardNarCoin)) : 0,
    };
  }

  async createQuest(data: {
    name: string;
    description?: string;
    type: QuestType;
    target: QuestTarget;
    targetValue: number;
    rewardNarCoin: number;
    rewardXP: number;
    rewardSkin?: any;
    isPremium: boolean;
    startDate: Date;
    endDate: Date;
  }) {
    const quest = this.questsRepository.create({
      name: data.name,
      description: data.description,
      type: data.type,
      target: data.target,
      targetValue: data.targetValue,
      rewardNarCoin: data.rewardNarCoin.toString(), // Преобразуем в строку для bigint
      rewardXP: data.rewardXP,
      rewardSkin: data.rewardSkin,
      isPremium: data.isPremium,
      startDate: data.startDate,
      endDate: data.endDate,
    });
    return this.questsRepository.save(quest);
  }

  async updateQuest(id: string, data: Partial<{
    name: string;
    description: string;
    type: QuestType;
    target: QuestTarget;
    targetValue: number;
    rewardNarCoin: number;
    rewardXP: number;
    rewardSkin: any;
    isPremium: boolean;
    startDate: Date;
    endDate: Date;
  }>) {
    const quest = await this.questsRepository.findOne({ where: { id } });
    if (!quest) {
      throw new Error('Квест не найден');
    }
    
    // Преобразуем rewardNarCoin в строку если он передан
    const updateData: any = { ...data };
    if (updateData.rewardNarCoin !== undefined) {
      updateData.rewardNarCoin = updateData.rewardNarCoin.toString();
    }
    
    Object.assign(quest, updateData);
    return this.questsRepository.save(quest);
  }

  async deleteQuest(id: string) {
    const quest = await this.questsRepository.findOne({ where: { id } });
    if (!quest) {
      throw new Error('Квест не найден');
    }
    await this.questsRepository.remove(quest);
    return { message: 'Квест удален' };
  }

  // CRUD для кланов
  async getAllClans() {
    return this.clansRepository.find({
      relations: ['members'],
      order: { createdAt: 'DESC' },
    });
  }

  async getClan(id: string) {
    const clan = await this.clansRepository.findOne({
      where: { id },
      relations: ['members'],
    });
    if (!clan) {
      throw new Error('Клан не найден');
    }
    return clan;
  }

  async updateClan(id: string, data: Partial<{
    name: string;
    description: string;
    level: number;
    maxMembers: number;
    treasury: number;
    weeklyIncome: number;
    clanLevel: number;
    districtStrength: number;
    economy: number;
    fortLevel: number;
  }>) {
    const clan = await this.clansRepository.findOne({ where: { id } });
    if (!clan) {
      throw new Error('Клан не найден');
    }
    Object.assign(clan, data);
    return this.clansRepository.save(clan);
  }

  async deleteClan(id: string) {
    const clan = await this.clansRepository.findOne({
      where: { id },
      relations: ['members'],
    });
    if (!clan) {
      throw new Error('Клан не найден');
    }

    // Удаляем всех членов клана
    await this.clanMembersRepository.delete({ clanId: id });

    // Удаляем клан
    await this.clansRepository.remove(clan);
    return { message: 'Клан удален' };
  }

  async removeClanMember(clanId: string, userId: string) {
    const member = await this.clanMembersRepository.findOne({
      where: { clanId, userId },
    });
    if (!member) {
      throw new Error('Член клана не найден');
    }

    await this.clanMembersRepository.remove(member);

    // Обновляем счетчик членов
    const clan = await this.clansRepository.findOne({ where: { id: clanId } });
    if (clan) {
      clan.memberCount = Math.max(0, clan.memberCount - 1);
      await this.clansRepository.save(clan);
    }

    return { message: 'Член клана удален' };
  }

  // Расширенные функции управления пользователями
  async updateUserBalance(userId: string, narCoin: number, xp?: number) {
    try {
      const user = await this.usersService.findOne(userId);
      const updateData: any = { narCoin: BigInt(narCoin) };
      if (xp !== undefined) {
        updateData.xp = BigInt(xp);
      }
      return this.usersService.update(userId, updateData);
    } catch (error) {
      this.logger.error(`Error updating balance for user ${userId}:`, error);
      throw new BadRequestException(`Ошибка при обновлении баланса: ${error.message}`);
    }
  }

  async updateUserReferralSettings(userId: string, settings: { referralPercent?: number; referralBaseBonus?: number }) {
    try {
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException('Пользователь не найден');
      }
      const updateData: any = {};
      if (settings.referralPercent !== undefined) {
        updateData.referralPercent = settings.referralPercent;
      }
      if (settings.referralBaseBonus !== undefined) {
        updateData.referralBaseBonus = BigInt(settings.referralBaseBonus);
      }
      return this.usersService.update(userId, updateData);
    } catch (error) {
      this.logger.error(`Error updating referral settings for user ${userId}:`, error);
      throw new BadRequestException(`Ошибка при обновлении настроек реферальной программы: ${error.message}`);
    }
  }

  async setUserLevel(userId: string, level: number) {
    const user = await this.usersService.findOne(userId);
    user.level = level;
    return this.usersRepository.save(user);
  }

  async setUserRole(userId: string, isAdmin: boolean, isTrainer: boolean) {
    const user = await this.usersService.findOne(userId);
    user.isAdmin = isAdmin;
    user.isTrainer = isTrainer;
    return this.usersRepository.save(user);
  }

  async resetUserProgress(userId: string) {
    const user = await this.usersService.findOne(userId);
    user.xp = BigInt(0);
    user.level = 1;
    user.narCoin = BigInt(1000);
    user.energy = user.maxEnergy;
    user.lives = user.maxLives;
    return this.usersRepository.save(user);
  }

  async giveSubscription(userId: string, plan: string, months?: number): Promise<any> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Если указано количество месяцев, создаем кастомную подписку
    if (months && months > 0) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + months);
      
      // Используем MONTH_1 как базовый план, но с кастомной датой окончания
      const subscriptionPlan = SubscriptionPlan.MONTH_1;
      
      // Деактивируем предыдущие активные подписки
      await this.subscriptionsRepository.update(
        { userId, isActive: true },
        { isActive: false },
      );
      
      // Создаем новую подписку
      const subscription = this.subscriptionsRepository.create({
        userId,
        plan: subscriptionPlan,
        startDate,
        endDate,
        isActive: true,
      });
      
      return this.subscriptionsRepository.save(subscription);
    }

    // Определяем план подписки для стандартных планов
    let subscriptionPlan: SubscriptionPlan;
    if (plan === 'month_1' || plan === '1') {
      subscriptionPlan = SubscriptionPlan.MONTH_1;
    } else if (plan === 'month_3' || plan === '3') {
      subscriptionPlan = SubscriptionPlan.MONTH_3;
    } else if (plan === 'month_12' || plan === '12') {
      subscriptionPlan = SubscriptionPlan.MONTH_12;
    } else {
      throw new BadRequestException('Неверный план подписки или количество месяцев');
    }

    return this.subscriptionService.createSubscription(userId, subscriptionPlan);
  }

  // Методы для работы с настройками системы
  async getSystemSetting(key: string, defaultValue: string = ''): Promise<string> {
    const setting = await this.systemSettingsRepository.findOne({ where: { key } });
    return setting ? setting.value : defaultValue;
  }

  async setSystemSetting(key: string, value: string, description?: string): Promise<SystemSettings> {
    let setting = await this.systemSettingsRepository.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      if (description) {
        setting.description = description;
      }
    } else {
      setting = this.systemSettingsRepository.create({ key, value, description });
    }
    return this.systemSettingsRepository.save(setting);
  }

  async getAllSystemSettings(): Promise<SystemSettings[]> {
    return this.systemSettingsRepository.find({ order: { key: 'ASC' } });
  }

  // CRUD для шаблонов уведомлений Telegram
  async getAllNotificationTemplates(): Promise<NotificationTemplate[]> {
    return this.notificationTemplatesRepository.find({
      order: { type: 'ASC' },
    });
  }

  async getNotificationTemplate(type: NotificationTemplateType): Promise<NotificationTemplate | null> {
    return this.notificationTemplatesRepository.findOne({ where: { type } });
  }

  async createNotificationTemplate(data: {
    type: NotificationTemplateType;
    title: string;
    message: string;
    isActive?: boolean;
    daysThreshold?: number;
  }): Promise<NotificationTemplate> {
    const existing = await this.notificationTemplatesRepository.findOne({ where: { type: data.type } });
    if (existing) {
      throw new BadRequestException(`Шаблон с типом "${data.type}" уже существует`);
    }

    const template = this.notificationTemplatesRepository.create({
      type: data.type,
      title: data.title,
      message: data.message,
      isActive: data.isActive !== undefined ? data.isActive : true,
      daysThreshold: data.daysThreshold || null,
    });

    return this.notificationTemplatesRepository.save(template);
  }

  async updateNotificationTemplate(type: NotificationTemplateType, data: {
    title?: string;
    message?: string;
    isActive?: boolean;
    daysThreshold?: number;
  }): Promise<NotificationTemplate> {
    const template = await this.notificationTemplatesRepository.findOne({ where: { type } });
    if (!template) {
      throw new NotFoundException('Шаблон не найден');
    }

    if (data.title !== undefined) template.title = data.title;
    if (data.message !== undefined) template.message = data.message;
    if (data.isActive !== undefined) template.isActive = data.isActive;
    if (data.daysThreshold !== undefined) template.daysThreshold = data.daysThreshold;

    return this.notificationTemplatesRepository.save(template);
  }

  /**
   * Отправка уведомления о неактивности пользователя через Telegram
   */
  async sendInactiveUserNotification(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user || !user.telegramId || user.isGuest || user.isBanned) {
      return;
    }

    // Получаем шаблон уведомления о неактивности
    const template = await this.getNotificationTemplate(NotificationTemplateType.INACTIVE_USER);
    if (!template || !template.isActive) {
      // Если шаблон не найден или неактивен, используем дефолтный
      const defaultMessage = '👋 Мы скучаем! Заходи в игру, чтобы не пропустить новые события и награды!';
      await this.sendTelegramMessage(user.telegramId, defaultMessage);
      return;
    }

    // Вычисляем количество дней неактивности
    const lastLogin = user.lastLogin || user.createdAt;
    const daysInactive = Math.floor((new Date().getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));

    // Заменяем переменные в шаблоне
    const message = this.replaceTemplateVariables(template.message, {
      username: user.nickname || user.firstName || user.username || 'Игрок',
      level: (user.level || 1).toString(),
      days: daysInactive.toString(),
    });

    const title = this.replaceTemplateVariables(template.title, {
      username: user.nickname || user.firstName || user.username || 'Игрок',
      level: (user.level || 1).toString(),
      days: daysInactive.toString(),
    });

    // Отправляем через Telegram
    await this.sendTelegramMessage(user.telegramId, `${title}\n\n${message}`);

    // Обновляем дату последнего уведомления
    user.lastInactiveNotification = new Date();
    await this.usersRepository.save(user);
  }

  /**
   * Заменяет переменные в шаблоне сообщения
   */
  private replaceTemplateVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  /**
   * Отправка сообщения через Telegram Bot API
   */
  private async sendTelegramMessage(telegramId: string, message: string): Promise<void> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не настроен, уведомление не отправлено');
      return;
    }

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: telegramId,
        text: message,
        parse_mode: 'HTML',
      });
    } catch (error: any) {
      this.logger.warn(`Не удалось отправить уведомление в Telegram пользователю ${telegramId}: ${error.message}`);
    }
  }

  async getPendingCourses(): Promise<any[]> {
    const courses = await this.articlesRepository.find({
      where: { type: 'course', isVerified: false },
      order: { createdAt: 'DESC' },
    });
    return courses.map((course) => ({
      id: course.id,
      title: course.title,
      author: course.author,
      authorId: course.authorId,
      price: Number(course.price || 0),
      description: course.content?.substring(0, 200) || '', // Используем content как description
      createdAt: course.createdAt,
    }));
  }

  /**
   * Инициализация: создаем дефолтные шаблоны, если их нет
   */
  async onModuleInit() {
    try {
      const existingTemplate = await this.getNotificationTemplate(NotificationTemplateType.INACTIVE_USER);
      if (!existingTemplate) {
        await this.createNotificationTemplate({
          type: NotificationTemplateType.INACTIVE_USER,
          title: '👋 Мы скучаем!',
          message: 'Привет, {username}! Ты не заходил в игру уже {days} дней. Заходи, чтобы не пропустить новые события и награды!',
          isActive: true,
          daysThreshold: 30,
        });
        this.logger.log('Создан дефолтный шаблон уведомления о неактивности');
      }
    } catch (error) {
      this.logger.error('Ошибка при инициализации шаблонов уведомлений:', error);
    }
  }
}

