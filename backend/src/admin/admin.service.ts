import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { AcademyService } from '../academy/academy.service';
import { SkinsService } from '../skins/skins.service';
import { GamesService } from '../games/games.service';
import { QuestsService } from '../quests/quests.service';
import { ClansService } from '../clans/clans.service';
import { User } from '../users/user.entity';
import { Game, GameMode, GameType, GameStatus } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { Article } from '../academy/article.entity';
import { Skin } from '../skins/skin.entity';
import { Quest, QuestType, QuestTarget } from '../quests/quest.entity';
import { Clan } from '../clans/clan.entity';
import { ClanMember } from '../clans/clan-member.entity';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AdminService {
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
    @InjectRepository(Quest)
    private questsRepository: Repository<Quest>,
    @InjectRepository(Clan)
    private clansRepository: Repository<Clan>,
    @InjectRepository(ClanMember)
    private clanMembersRepository: Repository<ClanMember>,
    private usersService: UsersService,
    private tournamentsService: TournamentsService,
    private academyService: AcademyService,
    private skinsService: SkinsService,
    private gamesService: GamesService,
    private questsService: QuestsService,
    private clansService: ClansService,
    private configService: ConfigService,
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
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Нельзя удалить админа
    if (user.isAdmin) {
      throw new Error('Нельзя удалить администратора');
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

    // Удаляем членство в кланах
    await this.clanMembersRepository.delete({ userId });

    // Удаляем самого пользователя
    await this.usersRepository.remove(user);
    
    return { message: 'Пользователь удален', userId };
  }

  async sendNotification(data: { userId?: string; message: string; all?: boolean }) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN не настроен');
    }

    if (data.all) {
      // Отправить всем пользователям
      const users = await this.usersRepository.find({
        where: { isBanned: false },
        select: ['telegramId'],
      });

      const results = [];
      for (const user of users) {
        try {
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: user.telegramId,
            text: data.message,
          });
          results.push({ userId: user.telegramId, status: 'sent' });
        } catch (error) {
          results.push({ userId: user.telegramId, status: 'error', error: error.message });
        }
      }
      return { sent: results.filter(r => r.status === 'sent').length, total: users.length, results };
    } else if (data.userId) {
      // Отправить конкретному пользователю
      const user = await this.usersRepository.findOne({ where: { id: data.userId } });
      if (!user) {
        throw new Error('Пользователь не найден');
      }

      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: user.telegramId,
        text: data.message,
      });

      return { success: true, userId: user.telegramId };
    }

    throw new Error('Укажите userId или установите all=true');
  }

  async createGame(data: { player1Id: string; player2Id?: string; mode: string; type: string }) {
    return this.gamesService.create(
      data.player1Id,
      data.player2Id || null,
      data.mode as GameMode,
      data.type as GameType,
    );
  }

  async createTournament(data: any) {
    return this.tournamentsService.create(data);
  }

  async getAllTournaments() {
    return this.tournamentsRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['matches'],
    });
  }

  async createArticle(data: any) {
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
    // Получаем настройки наград города (можно хранить в БД или конфиге)
    // Пока возвращаем дефолтные значения
    return {
      districts: [
        { id: 1, name: 'Клуб', incomePerHour: 10, maxAccumulation: 240 },
        { id: 2, name: 'Мастерская', incomePerHour: 15, maxAccumulation: 360 },
        { id: 3, name: 'Фабрика', incomePerHour: 20, maxAccumulation: 480 },
        { id: 4, name: 'Школа', incomePerHour: 25, maxAccumulation: 600 },
        { id: 5, name: 'Университет', incomePerHour: 30, maxAccumulation: 720 },
        { id: 6, name: 'Банк', incomePerHour: 40, maxAccumulation: 960 },
        { id: 7, name: 'Дворец', incomePerHour: 50, maxAccumulation: 1200 },
      ],
    };
  }

  async updateCityRewards(data: any) {
    // Сохраняем настройки наград (можно в БД или конфиг)
    // Пока просто возвращаем обновленные данные
    return data;
  }

  // CRUD для скинов
  async getAllSkins() {
    return this.skinsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async createSkin(data: {
    name: string;
    description?: string;
    theme: string;
    boardConfig: any;
    diceConfig: any;
    isDefault?: boolean;
    isPremium?: boolean;
    weight?: number;
    imageUrl?: string;
    price?: number;
    rarity?: string;
  }) {
    const skin = this.skinsRepository.create({
      name: data.name,
      description: data.description || null,
      theme: data.theme,
      boardConfig: data.boardConfig || {},
      diceConfig: data.diceConfig || {},
      isDefault: data.isDefault || false,
      isPremium: data.isPremium || false,
      weight: data.weight || 1,
      imageUrl: data.imageUrl || null,
      price: data.price || null,
      rarity: data.rarity || 'common',
    });

    return this.skinsRepository.save(skin);
  }

  async updateSkin(id: string, data: Partial<{
    name: string;
    description: string;
    theme: string;
    boardConfig: any;
    diceConfig: any;
    isDefault: boolean;
    isPremium: boolean;
    weight: number;
    imageUrl: string;
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
      throw new Error('Скин не найден');
    }

    await this.skinsRepository.remove(skin);
    return { message: 'Скин удален' };
  }

  async updateSkinImage(id: string, imageUrl: string) {
    const skin = await this.skinsRepository.findOne({ where: { id } });
    if (!skin) {
      throw new Error('Скин не найден');
    }

    skin.imageUrl = imageUrl;
    return this.skinsRepository.save(skin);
  }

  // CRUD для квестов
  async getAllQuests() {
    return this.questsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getQuest(id: string) {
    const quest = await this.questsRepository.findOne({ where: { id } });
    if (!quest) {
      throw new Error('Квест не найден');
    }
    return quest;
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
    const quest = this.questsRepository.create(data);
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
    Object.assign(quest, data);
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
    const user = await this.usersService.findOne(userId);
    const updateData: any = { narCoin };
    if (xp !== undefined) {
      updateData.xp = xp;
    }
    return this.usersService.update(userId, updateData);
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
}

