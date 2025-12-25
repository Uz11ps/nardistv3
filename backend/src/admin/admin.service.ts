import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, In } from 'typeorm';
import { UsersService } from '../users/users.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { AcademyService } from '../academy/academy.service';
import { SkinsService } from '../skins/skins.service';
import { GamesService } from '../games/games.service';
import { QuestsService } from '../quests/quests.service';
import { ClansService } from '../clans/clans.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { ProgressService } from '../progress/progress.service';
import { Subscription, SubscriptionPlan } from '../subscription/subscription.entity';
import { User } from '../users/user.entity';
import { Game, GameMode, GameType, GameStatus } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { Tournament, TournamentStatus } from '../tournaments/tournament.entity';
import { Article } from '../academy/article.entity';
import { Skin } from '../skins/skin.entity';
import { UserSkin } from '../skins/user-skin.entity';
import { Quest, QuestType, QuestTarget } from '../quests/quest.entity';
import { QuestProgress } from '../quests/quest-progress.entity';
import { Clan } from '../clans/clan.entity';
import { ClanMember } from '../clans/clan-member.entity';
import { ClanTreasuryTransaction } from '../clans/clan-treasury-transaction.entity';
import { BuildingConfig } from '../city/building-config.entity';
import { Building } from '../city/building.entity';
import { DistrictConfig } from '../city/district-config.entity';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { NotificationsService } from '../notifications/notifications.service';
import { Rating } from '../ratings/rating.entity';
import { Notification } from '../notifications/notification.entity';
import { UserMaterial } from '../academy/user-material.entity';
import { CourseTask, TaskType } from '../academy/course-task.entity';
import { CourseTaskProgress } from '../academy/course-task-progress.entity';
import { NotificationTemplate, NotificationTemplateType } from './notification-template.entity';
import { SystemSettings } from './system-settings.entity';
import { WalletService } from '../payment/wallet.service';
import { PaymentTransactionService } from '../payment/payment-transaction.service';
import { UserWallet } from '../payment/user-wallet.entity';
import { PaymentTransaction, PaymentStatus } from '../payment/payment-transaction.entity';
import { HistoryService } from '../history/history.service';

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
    @InjectRepository(QuestProgress)
    private questProgressRepository: Repository<QuestProgress>,
    @InjectRepository(Clan)
    private clansRepository: Repository<Clan>,
    @InjectRepository(ClanMember)
    private clanMembersRepository: Repository<ClanMember>,
    @InjectRepository(ClanTreasuryTransaction)
    private clanTransactionsRepository: Repository<ClanTreasuryTransaction>,
    @InjectRepository(Subscription)
    private subscriptionsRepository: Repository<Subscription>,
    @InjectRepository(BuildingConfig)
    private buildingConfigsRepository: Repository<BuildingConfig>,
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
    @InjectRepository(DistrictConfig)
    private districtConfigsRepository: Repository<DistrictConfig>,
    @InjectRepository(Rating)
    private ratingsRepository: Repository<Rating>,
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(UserMaterial)
    private userMaterialsRepository: Repository<UserMaterial>,
    @InjectRepository(CourseTask)
    private courseTasksRepository: Repository<CourseTask>,
    @InjectRepository(CourseTaskProgress)
    private courseTaskProgressRepository: Repository<CourseTaskProgress>,
    @InjectRepository(SystemSettings)
    private systemSettingsRepository: Repository<SystemSettings>,
    @InjectRepository(NotificationTemplate)
    private notificationTemplatesRepository: Repository<NotificationTemplate>,
    @InjectRepository(UserWallet)
    private walletsRepository: Repository<UserWallet>,
    @InjectRepository(PaymentTransaction)
    private paymentTransactionsRepository: Repository<PaymentTransaction>,
    private usersService: UsersService,
    private tournamentsService: TournamentsService,
    @Inject(forwardRef(() => AcademyService))
    private academyService: AcademyService,
    private skinsService: SkinsService,
    private gamesService: GamesService,
    private questsService: QuestsService,
    private clansService: ClansService,
    private subscriptionService: SubscriptionService,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private walletService: WalletService,
    private paymentTransactionService: PaymentTransactionService,
    @Inject(forwardRef(() => HistoryService))
    private historyService: HistoryService,
  ) {}

  async getStats() {
    const totalUsers = await this.usersRepository.count({ where: { isGuest: false } });
    const activeUsers = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.isGuest = false')
      .andWhere('user.updatedAt > :date', { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
      .getCount();
    
    const totalGames = await this.gamesRepository.count();
    const finishedGames = await this.gamesRepository.count({ where: { status: GameStatus.FINISHED } });
    const inProgressGames = await this.gamesRepository.count({ where: { status: GameStatus.IN_PROGRESS } });
    
    const totalMoves = await this.movesRepository.count();
    
    const bannedUsers = await this.usersRepository.count({ where: { isBanned: true, isGuest: false } });
    const adminUsers = await this.usersRepository.count({ where: { isAdmin: true, isGuest: false } });
    
    const totalNarCoin = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.isGuest = false')
      .select('SUM(user.narCoin)', 'total')
      .getRawOne();
    
    const totalXp = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.isGuest = false')
      .select('SUM(user.xp)', 'total')
      .getRawOne();

    // Статистика по уровням
    const levelStatsRaw = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.isGuest = false')
      .select('user.level', 'level')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.level')
      .orderBy('user.level', 'ASC')
      .getRawMany();

    const levelStats = levelStatsRaw.map(item => ({
      level: Number(item.level || 0),
      count: String(item.count || 0)
    }));

    // Статистика по играм за последние 7 дней - исправлено для PostgreSQL
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Создаем массив всех дат за последние 7 дней
    const dateArray: { date: string; count: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      dateArray.push({
        date: date.toISOString().split('T')[0],
        count: '0'
      });
    }

    // Получаем данные из БД
    const gamesLast7DaysRaw = await this.gamesRepository
      .createQueryBuilder('game')
      .where('game.createdAt >= :date', { date: sevenDaysAgo })
      .select("TO_CHAR(game.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(game.createdAt, 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(game.createdAt, 'YYYY-MM-DD')", 'ASC')
      .getRawMany();

    // Объединяем данные: заполняем реальные значения и оставляем нули для дат без игр
    const gamesMap = new Map<string, string>();
    gamesLast7DaysRaw.forEach(item => {
      if (item.date) {
        gamesMap.set(item.date, String(item.count || 0));
      }
    });

    const gamesLast7Days = dateArray.map(item => ({
      date: item.date,
      count: gamesMap.get(item.date) || '0'
    }));

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
      where: { isGuest: false },
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
    // Баним пользователя независимо от связанных объектов
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Нельзя забанить админа
    if (user.isAdmin) {
      throw new BadRequestException('Нельзя забанить администратора');
    }

    user.isBanned = true;
    user.banReason = reason || 'Бан администратором';
    return this.usersRepository.save(user);
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

      // Удаляем пользователя с каскадным удалением всех связанных данных
      // Используем raw queries для принудительного удаления независимо от foreign key constraints
      const queryRunner = this.usersRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Используем queryRunner.manager для всех операций в рамках одной транзакции (PostgreSQL)
        
        // Удаляем все связанные данные через queryRunner.manager
        try {
          await queryRunner.manager.delete(Subscription, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete subscriptions for user ${userId}:`, error.message);
        }

        try {
          await queryRunner.manager.delete(Rating, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete ratings for user ${userId}:`, error.message);
        }

        try {
          await queryRunner.manager.delete(Notification, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete notifications for user ${userId}:`, error.message);
        }

        try {
          await queryRunner.manager.delete(UserMaterial, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete user_materials for user ${userId}:`, error.message);
        }

        try {
          await queryRunner.manager.delete(UserSkin, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete user_skins for user ${userId}:`, error.message);
        }

        try {
          await queryRunner.manager.delete(ClanMember, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete clan_members for user ${userId}:`, error.message);
        }

        try {
          await queryRunner.manager.delete(QuestProgress, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete quest_progress for user ${userId}:`, error.message);
        }

        try {
          await queryRunner.manager.delete(Building, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete buildings for user ${userId}:`, error.message);
        }

        try {
          await queryRunner.manager.delete(CourseTaskProgress, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete course_task_progress for user ${userId}:`, error.message);
        }

        try {
          await queryRunner.manager.delete(PaymentTransaction, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete payment_transactions for user ${userId}:`, error.message);
        }

        try {
          await queryRunner.manager.delete(UserWallet, { userId });
        } catch (error: any) {
          this.logger.warn(`Failed to delete wallets for user ${userId}:`, error.message);
        }

        // Удаляем ходы игр пользователя (через raw query, так как нужно найти игры сначала)
        try {
          const userGames = await queryRunner.manager.find(Game, {
            where: [
              { player1Id: userId },
              { player2Id: userId }
            ],
            select: ['id']
          });
          const gameIds = userGames.map(g => g.id);
          if (gameIds.length > 0) {
            await queryRunner.manager.delete(GameMove, { gameId: In(gameIds) });
          }
        } catch (error: any) {
          this.logger.warn(`Failed to delete game moves for user ${userId}:`, error.message);
        }

        // Обнуляем ссылки на пользователя в играх (через query builder)
        try {
          await queryRunner.manager
            .createQueryBuilder()
            .update(Game)
            .set({ player1Id: null, player2Id: null, winnerId: null })
            .where('player1Id = :userId OR player2Id = :userId OR winnerId = :userId', { userId })
            .execute();
        } catch (error: any) {
          this.logger.warn(`Failed to update games for user ${userId}:`, error.message);
        }

        // Удаляем самого пользователя
        await queryRunner.manager.delete(User, { id: userId });
        
        await queryRunner.commitTransaction();
        
        return { message: 'Пользователь удален', userId };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
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
            if (data.imageUrl) {
              // Отправляем с изображением
              const imagePath = join(process.cwd(), 'frontend', 'public', data.imageUrl);
              const FormData = require('form-data');
              const fs = require('fs');
              const form = new FormData();
              form.append('chat_id', user.telegramId);
              form.append('caption', message);
              form.append('photo', fs.createReadStream(imagePath));
              
              await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, form, {
                headers: form.getHeaders(),
              });
            } else {
              // Отправляем только текст
              await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: user.telegramId,
                text: message,
              });
            }
            results.push({ userId: user.telegramId, status: 'sent' });
          } catch (error: any) {
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
      if (botToken && user.telegramId) {
        try {
          if (data.imageUrl) {
            // Отправляем с изображением
            const imagePath = join(process.cwd(), 'frontend', 'public', data.imageUrl);
            const FormData = require('form-data');
            const fs = require('fs');
            const form = new FormData();
            form.append('chat_id', user.telegramId);
            form.append('caption', message);
            form.append('photo', fs.createReadStream(imagePath));
            
            await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, form, {
              headers: form.getHeaders(),
            });
          } else {
            // Отправляем только текст
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              chat_id: user.telegramId,
              text: message,
            });
          }
        } catch (error: any) {
          // Игнорируем ошибки Telegram, так как уведомление уже сохранено в БД
          this.logger.warn(`Не удалось отправить уведомление в Telegram пользователю ${user.id}: ${error.message}`);
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

  async createGame(data: { 
    player1Id: string; 
    player2Id?: string; 
    mode: string; 
    type: string;
    stake?: number;
    moveTimeout?: number;
    tournamentId?: string;
  }) {
    try {
      // Функция для поиска пользователя по UUID, username, nickname или telegramId
      const findUser = async (identifier: string): Promise<User> => {
        // Пробуем найти по UUID
        try {
          const user = await this.usersService.findOne(identifier);
          if (user) return user;
        } catch (e) {
          // Игнорируем ошибку, пробуем другие способы
        }

        // Пробуем найти по username
        const byUsername = await this.usersRepository.findOne({ where: { username: identifier } });
        if (byUsername) return byUsername;

        // Пробуем найти по nickname
        const byNickname = await this.usersRepository.findOne({ where: { nickname: identifier } });
        if (byNickname) return byNickname;

        // Пробуем найти по telegramId
        const byTelegramId = await this.usersRepository.findOne({ where: { telegramId: identifier } });
        if (byTelegramId) return byTelegramId;

        throw new NotFoundException(`Пользователь не найден: ${identifier}`);
      };

      const player1 = await findUser(data.player1Id);
      const player1Id = player1.id;

      let player2Id: string | null = null;
      if (data.player2Id && data.player2Id.trim()) {
        const player2 = await findUser(data.player2Id);
        player2Id = player2.id;
      }

      // Вычисляем moveTimeLimit из moveTimeout (если указан в секундах, конвертируем в миллисекунды)
      const moveTimeLimit = data.moveTimeout ? data.moveTimeout * 1000 : 60000;

      // Создаем игру через GamesService
      const game = await this.gamesService.create(
        player1Id,
        player2Id,
        data.mode as GameMode,
        data.type as GameType,
        data.stake || 0,
        moveTimeLimit,
      );

      // Если указана ставка, обновляем игру (если не передана в create)
      if (data.stake && data.stake > 0 && game.stake !== data.stake) {
        await this.gamesRepository.update(game.id, { stake: data.stake });
        game.stake = data.stake;
      }

      // Если оба игрока есть, автоматически делаем начальный бросок кубиков для определения первого ходящего
      if (player2Id && game.status === GameStatus.IN_PROGRESS) {
        try {
          // Используем ту же формулу что и в rollDice для определения индекса начального броска
          // Формула: (Смещение игрока - 1) * 2 + Смещение соперника
          const p1Offset = game.p1Offset || 1;
          const p2Offset = game.p2Offset || 1;
          
          // Для player1: (p1Offset - 1) * 2 + p2Offset
          const p1StartIdx = ((p1Offset - 1) * 2 + p2Offset) % (game.p1Rolls?.length || 1000);
          // Для player2: (p2Offset - 1) * 2 + p1Offset
          const p2StartIdx = ((p2Offset - 1) * 2 + p1Offset) % (game.p2Rolls?.length || 1000);
          
          // Берем начальный бросок каждого игрока для определения первого ходящего
          const p1FirstRoll = game.p1Rolls && game.p1Rolls.length > p1StartIdx ? game.p1Rolls[p1StartIdx] : [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
          const p2FirstRoll = game.p2Rolls && game.p2Rolls.length > p2StartIdx ? game.p2Rolls[p2StartIdx] : [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
          
          // Определяем кто ходит первым по сумме кубиков
          const sum1 = p1FirstRoll[0] + p1FirstRoll[1];
          const sum2 = p2FirstRoll[0] + p2FirstRoll[1];
          
          // Если суммы равны, выбираем player1 (можно доработать чтобы бросать еще раз)
          const firstPlayerId = sum1 >= sum2 ? player1Id : player2Id;
          const firstPlayer = firstPlayerId === player1Id ? 0 : 1;
          
          // Устанавливаем первого ходящего
          await this.gamesRepository.update(game.id, { currentPlayer: firstPlayer });
          
          // Теперь делаем рабочий бросок для первого ходящего (это его первый ход)
          // rollDice автоматически использует правильный индекс на основе playerMovesCount (который будет 0 для первого хода)
          // Это означает что он возьмет тот же индекс что и для начального броска, но это ОК т.к. начальный бросок был только для определения первого ходящего и не сохранялся
          await this.gamesService.rollDice(game.id, firstPlayerId, false);
          
          this.logger.log(`Game ${game.id} started with initial dice roll. P1: [${p1FirstRoll.join(', ')}] (sum=${sum1}, idx=${p1StartIdx}), P2: [${p2FirstRoll.join(', ')}] (sum=${sum2}, idx=${p2StartIdx}). First player: ${firstPlayerId} (player ${firstPlayer})`);
        } catch (error) {
          this.logger.error(`Error during initial dice roll for game ${game.id}:`, error);
          // Не падаем, игра уже создана
        }
      }

      // Если указан tournamentId, связываем игру с турниром
      if (data.tournamentId) {
        // Логика связывания с турниром будет в GamesService или здесь
        this.logger.log(`Game ${game.id} linked to tournament ${data.tournamentId}`);
      }

      // Перезагружаем игру чтобы получить актуальное состояние
      return await this.gamesService.findOne(game.id);
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
      .orderBy('config.type', 'ASC')
      .getMany();

    return {
      buildings: configs.map(c => ({
        id: c.id,
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
            type: buildingData.type,
            name: buildingData.name || buildingData.type,
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

    // Проверяем, нет ли связанных предприятий (больше не проверяем по district, так как его нет)
    // Districts больше не используются, но оставляем метод для обратной совместимости

    await this.districtConfigsRepository.remove(district);
    return { message: 'Территория удалена' };
  }

  // CRUD для конфигураций строений
  async getAllBuildingConfigs(districtId?: string) {
    const where = districtId ? { districtId } : {};
    const configs = await this.buildingConfigsRepository.find({
      where,
      order: { type: 'ASC' },
    });
    
    return configs.map(c => ({
      id: c.id,
      type: c.type,
      name: c.name,
      icon: c.icon,
      image: c.image,
      basePrice: Number(c.basePrice),
      baseIncomePerHour: Number(c.baseIncomePerHour),
      maxAccumulation: Number(c.maxAccumulation),
      maxLevel: c.maxLevel,
      upgradeMultiplier: c.upgradeMultiplier || 1.4,
      upgradeCosts: c.upgradeCosts,
      districtId: c.districtId,
    }));
  }

  async getBuildingConfig(id: string) {
    const config = await this.buildingConfigsRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException('Конфигурация строения не найдена');
    }
    
    return {
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
      upgradeCosts: config.upgradeCosts,
      districtId: config.districtId,
    };
  }

  async createBuildingConfig(data: {
    type: string;
    name: string;
    icon?: string;
    image?: string;
    basePrice: number;
    baseIncomePerHour: number;
    maxAccumulation?: number;
    maxLevel?: number;
    upgradeMultiplier?: number;
    upgradeCosts?: any;
    districtId?: string;
  }) {
    const config = this.buildingConfigsRepository.create({
      type: data.type,
      name: data.name,
      icon: data.icon || null,
      image: data.image || null,
      basePrice: data.basePrice.toString(),
      baseIncomePerHour: data.baseIncomePerHour.toString(),
      maxAccumulation: (data.maxAccumulation || 0).toString(),
      maxLevel: data.maxLevel || 10,
      districtId: data.districtId || null,
      upgradeMultiplier: data.upgradeMultiplier || 1.4,
      upgradeCosts: data.upgradeCosts || null,
    });

    const savedConfig = await this.buildingConfigsRepository.save(config);
    
      return {
        id: savedConfig.id,
        type: savedConfig.type,
        name: savedConfig.name,
        icon: savedConfig.icon,
        image: savedConfig.image,
        basePrice: Number(savedConfig.basePrice),
        baseIncomePerHour: Number(savedConfig.baseIncomePerHour),
        maxAccumulation: Number(savedConfig.maxAccumulation),
        maxLevel: savedConfig.maxLevel,
        upgradeMultiplier: savedConfig.upgradeMultiplier || 1.4,
        upgradeCosts: savedConfig.upgradeCosts,
      };
  }

  async updateBuildingConfig(id: string, data: Partial<{
    type: string;
    name: string;
    icon: string;
    image: string;
    basePrice: number;
    baseIncomePerHour: number;
    maxAccumulation: number;
    maxLevel: number;
    upgradeMultiplier: number;
    upgradeCosts: any;
    districtId: string;
  }>) {
    const config = await this.buildingConfigsRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException('Конфигурация строения не найдена');
    }

    Object.assign(config, {
      ...data,
      basePrice: data.basePrice !== undefined ? data.basePrice.toString() : config.basePrice,
      baseIncomePerHour: data.baseIncomePerHour !== undefined ? data.baseIncomePerHour.toString() : config.baseIncomePerHour,
      maxAccumulation: data.maxAccumulation !== undefined ? data.maxAccumulation.toString() : config.maxAccumulation,
      upgradeMultiplier: data.upgradeMultiplier !== undefined ? data.upgradeMultiplier : (config.upgradeMultiplier || 1.4),
    });

    const savedConfig = await this.buildingConfigsRepository.save(config);
    
    return {
      id: savedConfig.id,
      type: savedConfig.type,
      name: savedConfig.name,
      icon: savedConfig.icon,
      image: savedConfig.image,
      basePrice: Number(savedConfig.basePrice),
      baseIncomePerHour: Number(savedConfig.baseIncomePerHour),
      maxAccumulation: Number(savedConfig.maxAccumulation),
      maxLevel: savedConfig.maxLevel,
      upgradeMultiplier: savedConfig.upgradeMultiplier || 1.4,
      upgradeCosts: savedConfig.upgradeCosts,
    };
  }

  async deleteBuildingConfig(id: string) {
    const config = await this.buildingConfigsRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException('Конфигурация строения не найдена');
    }

    // Удаляем все связанные строения пользователей
    const buildingsToDelete = await this.buildingsRepository.find({
      where: { type: config.type },
    });

    if (buildingsToDelete.length > 0) {
      // Удаляем все связанные строения
      await this.buildingsRepository.remove(buildingsToDelete);
      this.logger.log(`Удалено ${buildingsToDelete.length} строений типа "${config.type}" у пользователей`);
    }

    // Удаляем конфигурацию
    await this.buildingConfigsRepository.remove(config);
    return { 
      message: 'Конфигурация строения удалена',
      deletedBuildings: buildingsToDelete.length 
    };
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
    diceTextureUrls?: any;
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
      diceTextureUrls: data.diceTextureUrls || null,
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
    diceTextureUrls: any;
    checkersTextureUrl: string;
    whiteCheckersTextureUrl: string;
    blackCheckersTextureUrl: string;
    price: number;
    rarity: string;
    maxDurability: number;
    xpBonusPercent: number;
    moneyBonusPercent: number;
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
    try {
      const clan = await this.clansRepository.findOne({
        where: { id },
        relations: ['members'],
      });
      if (!clan) {
        throw new NotFoundException('Федерация не найдена');
      }

      // Удаляем всех членов клана
      await this.clanMembersRepository.delete({ clanId: id });

      // Удаляем все транзакции казны
      await this.clanTransactionsRepository.delete({ clanId: id });

      // Удаляем клан
      await this.clansRepository.remove(clan);
      return { message: 'Федерация удалена' };
    } catch (error) {
      this.logger.error(`Ошибка при удалении федерации ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при удалении федерации: ${error.message}`);
    }
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
      if (narCoin === undefined || narCoin === null || isNaN(narCoin)) {
        throw new BadRequestException('Некорректное значение NAR-coin');
      }
      
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new BadRequestException('Пользователь не найден');
      }
      
      // Обновляем баланс
      user.narCoin = BigInt(Math.max(0, Math.floor(narCoin)));
      
      if (xp !== undefined && xp !== null) {
        // Конвертируем XP в число
        const xpValue = typeof xp === 'string' ? parseInt(xp, 10) : Number(xp);
        if (isNaN(xpValue)) {
          throw new BadRequestException('Некорректное значение XP');
        }
        // Обновляем XP
        user.xp = BigInt(Math.max(0, Math.floor(xpValue)));
        
        // Синхронизируем уровень на основе нового XP
        const totalXP = Number(user.xp);
        const correctLevel = this.getLevelFromTotalXP(totalXP);
        user.level = Math.max(1, correctLevel);
      }
      
      // Сохраняем изменения через usersService
      const savedUser = await this.usersService['usersRepository'].save(user);
      this.logger.log(`✅ Обновлен баланс пользователя ${userId}: NAR=${narCoin}, XP=${xp || 'не изменен'}, Level=${savedUser.level}`);
      
      return {
        id: savedUser.id,
        narCoin: Number(savedUser.narCoin),
        xp: Number(savedUser.xp),
        level: savedUser.level,
      };
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
    try {
      if (level === undefined || level === null || isNaN(level)) {
        throw new BadRequestException('Некорректное значение уровня');
      }
      
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new BadRequestException('Пользователь не найден');
      }
      
      const finalLevel = Math.max(1, Math.min(50, Math.floor(Number(level)))); // Ограничиваем от 1 до 50
      
      // При установке уровня вручную, синхронизируем XP с уровнем
      const totalXP = this.getTotalXPForLevel(finalLevel);
      if (isNaN(totalXP) || totalXP < 0 || !isFinite(totalXP)) {
        this.logger.error(`Ошибка расчета XP для уровня ${finalLevel}: totalXP=${totalXP}`);
        throw new BadRequestException(`Ошибка расчета XP для уровня ${finalLevel}`);
      }
      
      user.level = finalLevel;
      user.xp = BigInt(Math.max(0, Math.floor(totalXP)));
      
      const savedUser = await this.usersRepository.save(user);
      this.logger.log(`✅ Установлен уровень пользователя ${userId}: Level=${finalLevel}, XP=${totalXP}`);
      
      return {
        id: savedUser.id,
        level: savedUser.level,
        xp: Number(savedUser.xp),
        username: savedUser.username,
        nickname: savedUser.nickname,
      };
    } catch (error) {
      this.logger.error(`Error setting level for user ${userId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при установке уровня: ${error.message || 'Неизвестная ошибка'}`);
    }
  }

  async syncUserLevelFromXP(userId: string) {
    const user = await this.usersService.findOne(userId);
    const totalXP = Number(user.xp || 0);
    const correctLevel = this.getLevelFromTotalXP(totalXP);
    
    // Убеждаемся, что уровень не меньше 1
    const finalLevel = Math.max(1, correctLevel);
    
    if (user.level !== finalLevel) {
      user.level = finalLevel;
      await this.usersRepository.save(user);
      this.logger.log(`✅ Синхронизирован уровень пользователя ${userId}: XP=${totalXP} -> Level=${finalLevel}`);
    }
    return user;
  }

  // Вспомогательные методы для расчета уровня (та же логика, что в ProgressService)
  /**
   * Вычисляет требуемый XP для перехода с уровня (level-1) на level
   */
  private getXPRequiredForLevel(level: number): number {
    if (level <= 1) return 0;
    if (level === 2) return 200;
    // Для уровней 3-50: предыдущий переход * 1.25, округляем до кратных 10
    let xp = 200;
    for (let i = 3; i <= level; i++) {
      xp = Math.floor(xp * 1.25);
      // Округляем до кратных 10
      xp = Math.round(xp / 10) * 10;
    }
    return xp;
  }

  /**
   * Вычисляет общий XP для уровня (сумма всех переходов до этого уровня)
   */
  private getTotalXPForLevel(level: number): number {
    if (level <= 1) return 0;
    let totalXP = 0;
    for (let i = 2; i <= level; i++) {
      totalXP += this.getXPRequiredForLevel(i);
    }
    return totalXP;
  }

  private getLevelFromTotalXP(totalXP: number): number {
    const MAX_LEVEL = 50;
    if (totalXP <= 0) return 1;
    
    let level = 1;
    while (level < MAX_LEVEL) {
      const xpForNextLevel = this.getTotalXPForLevel(level + 1);
      if (totalXP >= xpForNextLevel) {
        level++;
      } else {
        break;
      }
    }
    return level;
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

  /**
   * Получить все кошельки пользователей
   */
  async getAllWallets(): Promise<any[]> {
    const wallets = await this.walletService.getAllWallets();
    return wallets.map(w => ({
      id: w.id,
      userId: w.userId,
      username: w.user?.username || 'Unknown',
      address: w.address,
      walletType: w.walletType,
      isActive: w.isActive,
      createdAt: w.createdAt,
      balance: 0, // Можно добавить получение баланса
    }));
  }

  /**
   * Получить расшифрованный приватный ключ кошелька (только для админа)
   */
  async getWalletPrivateKey(walletId: string): Promise<{ privateKey: string; address: string }> {
    const wallet = await this.walletsRepository.findOne({ where: { id: walletId } });
    if (!wallet) {
      throw new NotFoundException('Кошелек не найден');
    }

    const privateKey = await this.walletService.getDecryptedPrivateKey(walletId);
    return {
      privateKey,
      address: wallet.address,
    };
  }

  /**
   * Получить транзакции пользователя
   */
  async getUserTransactions(userId: string): Promise<any[]> {
    return this.paymentTransactionService.getUserTransactions(userId);
  }

  /**
   * Получить все транзакции
   */
  async getAllTransactions(limit: number = 100): Promise<any[]> {
    return this.paymentTransactionsRepository.find({
      relations: ['user', 'wallet', 'subscription'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Проверить статус транзакции в блокчейне
   */
  async checkTransactionStatus(transactionId: string): Promise<any> {
    const transaction = await this.paymentTransactionService.checkTransactionStatus(transactionId);
    return transaction;
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

  async deleteNotificationTemplate(type: NotificationTemplateType): Promise<void> {
    const template = await this.notificationTemplatesRepository.findOne({ where: { type } });
    if (!template) {
      throw new NotFoundException('Шаблон не найден');
    }
    await this.notificationTemplatesRepository.remove(template);
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

  // ==================== ONBOARDING TASKS MANAGEMENT ====================

  /**
   * Получить все онбординговые задания
   */
  async getAllOnboardingTasks(): Promise<CourseTask[]> {
    return this.courseTasksRepository.find({
      where: { isOnboarding: true },
      order: { order: 'ASC' },
    });
  }

  /**
   * Получить онбординговое задание по ID
   */
  async getOnboardingTask(id: string): Promise<CourseTask> {
    const task = await this.courseTasksRepository.findOne({
      where: { id, isOnboarding: true },
    });
    if (!task) {
      throw new NotFoundException('Онбординговое задание не найдено');
    }
    return task;
  }

  /**
   * Создать онбординговое задание
   */
  async createOnboardingTask(data: Partial<CourseTask>): Promise<CourseTask> {
    const task = this.courseTasksRepository.create({
      ...data,
      isOnboarding: true,
      courseId: null, // Онбординговые задания не привязаны к курсу
    });
    return this.courseTasksRepository.save(task);
  }

  /**
   * Обновить онбординговое задание
   */
  async updateOnboardingTask(id: string, data: Partial<CourseTask>): Promise<CourseTask> {
    const task = await this.getOnboardingTask(id);
    Object.assign(task, data);
    // Убеждаемся, что задание остается онбординговым
    task.isOnboarding = true;
    task.courseId = null;
    return this.courseTasksRepository.save(task);
  }

  /**
   * Удалить онбординговое задание
   */
  async deleteOnboardingTask(id: string): Promise<void> {
    const task = await this.getOnboardingTask(id);
    await this.courseTasksRepository.remove(task);
  }

  /**
   * Получить статистику по онбордингу
   */
  async getOnboardingStats(): Promise<any> {
    const totalTasks = await this.courseTasksRepository.count({
      where: { isOnboarding: true },
    });
    const activeTasks = await this.courseTasksRepository.count({
      where: { isOnboarding: true, isActive: true },
    });
    
    // Статистика по прогрессу пользователей
    const totalProgress = await this.courseTaskProgressRepository
      .createQueryBuilder('progress')
      .innerJoin('progress.task', 'task')
      .where('task.isOnboarding = true')
      .getCount();
    
    const completedProgress = await this.courseTaskProgressRepository
      .createQueryBuilder('progress')
      .innerJoin('progress.task', 'task')
      .where('task.isOnboarding = true')
      .andWhere('progress.isCompleted = true')
      .getCount();

    return {
      totalTasks,
      activeTasks,
      totalProgress,
      completedProgress,
      completionRate: totalProgress > 0 ? (completedProgress / totalProgress) * 100 : 0,
    };
  }

  // ========== РАСШИРЕННОЕ РЕДАКТИРОВАНИЕ ПОЛЬЗОВАТЕЛЕЙ ==========
  async updateUserFull(userId: string, data: {
    narCoin?: number;
    xp?: number;
    level?: number;
    energy?: number;
    maxEnergy?: number;
    lives?: number;
    maxLives?: number;
    skillPoints?: number;
    freeSkillPoints?: number;
    economySp?: number;
    energySp?: number;
    livesSp?: number;
    powerSp?: number;
    hasBusinessLicense?: boolean;
    referralPercent?: number;
    referralBaseBonus?: number;
  }) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (data.narCoin !== undefined) user.narCoin = BigInt(data.narCoin);
    if (data.xp !== undefined) user.xp = BigInt(data.xp);
    if (data.level !== undefined) user.level = data.level;
    if (data.energy !== undefined) user.energy = data.energy;
    if (data.maxEnergy !== undefined) user.maxEnergy = data.maxEnergy;
    if (data.lives !== undefined) user.lives = data.lives;
    if (data.maxLives !== undefined) user.maxLives = data.maxLives;
    if (data.skillPoints !== undefined) user.skillPoints = data.skillPoints;
    if (data.freeSkillPoints !== undefined) user.freeSkillPoints = data.freeSkillPoints;
    if (data.economySp !== undefined) user.economySp = data.economySp;
    if (data.energySp !== undefined) user.energySp = data.energySp;
    if (data.livesSp !== undefined) user.livesSp = data.livesSp;
    if (data.powerSp !== undefined) user.powerSp = data.powerSp;
    if (data.hasBusinessLicense !== undefined) user.hasBusinessLicense = data.hasBusinessLicense;
    if (data.referralPercent !== undefined) user.referralPercent = Math.max(0, Math.min(100, Math.floor(data.referralPercent)));
    if (data.referralBaseBonus !== undefined) user.referralBaseBonus = BigInt(Math.max(0, Math.floor(data.referralBaseBonus)));

    await this.usersRepository.save(user);
    return user;
  }

  // ========== ОТДЕЛЬНЫЕ МЕТОДЫ ДЛЯ РЕДАКТИРОВАНИЯ ПОЛЬЗОВАТЕЛЕЙ ==========
  
  async updateUserProfile(userId: string, data: {
    username?: string;
    nickname?: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    languageCode?: string;
    avatarUrl?: string;
  }) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (data.username !== undefined) user.username = data.username;
    if (data.nickname !== undefined) user.nickname = data.nickname;
    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.lastName !== undefined) user.lastName = data.lastName;
    if (data.country !== undefined) user.country = data.country;
    if (data.languageCode !== undefined) user.languageCode = data.languageCode;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;

    await this.usersRepository.save(user);
    return user;
  }

  async updateUserTelegram(userId: string, data: {
    telegramId?: string;
  }) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (data.telegramId !== undefined) {
      // Проверяем уникальность telegramId
      const existing = await this.usersRepository.findOne({ where: { telegramId: data.telegramId } });
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Пользователь с таким telegramId уже существует');
      }
      user.telegramId = data.telegramId;
    }

    await this.usersRepository.save(user);
    return user;
  }

  async updateUserReferral(userId: string, data: {
    referralCode?: string;
    referredBy?: string;
    referralPercent?: number;
    referralBaseBonus?: number;
    totalReferralEarnings?: number;
  }) {
    try {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Пользователь не найден');
      }

      if (data.referralCode !== undefined && data.referralCode !== null) {
        // Проверяем уникальность referralCode
        const existing = await this.usersRepository.findOne({ where: { referralCode: data.referralCode } });
        if (existing && existing.id !== userId) {
          throw new BadRequestException('Пользователь с таким referralCode уже существует');
        }
        user.referralCode = data.referralCode;
      }
      if (data.referredBy !== undefined) user.referredBy = data.referredBy;
      if (data.referralPercent !== undefined && data.referralPercent !== null) {
        const value = typeof data.referralPercent === 'number' ? data.referralPercent : parseInt(String(data.referralPercent)) || 5;
        user.referralPercent = Math.max(0, Math.min(100, Math.floor(value)));
      }
      if (data.referralBaseBonus !== undefined && data.referralBaseBonus !== null) {
        const value = typeof data.referralBaseBonus === 'number' ? data.referralBaseBonus : parseInt(String(data.referralBaseBonus)) || 100;
        user.referralBaseBonus = BigInt(Math.max(0, Math.floor(value)));
      }
      if (data.totalReferralEarnings !== undefined && data.totalReferralEarnings !== null) {
        const value = typeof data.totalReferralEarnings === 'number' ? data.totalReferralEarnings : parseInt(String(data.totalReferralEarnings)) || 0;
        user.totalReferralEarnings = BigInt(Math.max(0, Math.floor(value)));
      }

      await this.usersRepository.save(user);
      return user;
    } catch (error: any) {
      this.logger.error(`Error updating user referral for ${userId}:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при обновлении реферальных данных пользователя: ${error.message}`);
    }
  }

  async updateUserEconomy(userId: string, data: {
    narCoin?: number;
    xp?: number;
    level?: number;
  }) {
    try {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Пользователь не найден');
      }

      if (data.narCoin !== undefined && data.narCoin !== null) {
        const narCoinValue = typeof data.narCoin === 'number' ? data.narCoin : parseInt(String(data.narCoin)) || 0;
        user.narCoin = BigInt(Math.max(0, Math.floor(narCoinValue)));
      }

      if (data.xp !== undefined && data.xp !== null) {
        const xpValue = typeof data.xp === 'number' ? data.xp : parseInt(String(data.xp)) || 0;
        user.xp = BigInt(Math.max(0, Math.floor(xpValue)));
        // Синхронизируем уровень на основе нового XP
        try {
          const totalXP = Number(user.xp);
          const correctLevel = this.getLevelFromTotalXP(totalXP);
          user.level = Math.max(1, correctLevel);
        } catch (error: any) {
          this.logger.warn(`Failed to calculate level from XP ${user.xp}:`, error.message);
          // Если не удалось рассчитать уровень, оставляем текущий
        }
      }

      if (data.level !== undefined && data.level !== null) {
        const levelValue = typeof data.level === 'number' ? data.level : parseInt(String(data.level)) || 1;
        user.level = Math.max(1, Math.min(50, Math.floor(levelValue)));
      }

      await this.usersRepository.save(user);
      return user;
    } catch (error: any) {
      this.logger.error(`Error updating user economy for ${userId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при обновлении экономики пользователя: ${error.message}`);
    }
  }

  async updateUserEnergy(userId: string, data: {
    energy?: number;
    maxEnergy?: number;
  }) {
    try {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Пользователь не найден');
      }

      if (data.energy !== undefined && data.energy !== null) {
        const energyValue = typeof data.energy === 'number' ? data.energy : parseInt(String(data.energy)) || 0;
        user.energy = Math.max(0, Math.floor(energyValue));
      }
      if (data.maxEnergy !== undefined && data.maxEnergy !== null) {
        const maxEnergyValue = typeof data.maxEnergy === 'number' ? data.maxEnergy : parseInt(String(data.maxEnergy)) || 100;
        user.maxEnergy = Math.max(1, Math.floor(maxEnergyValue));
      }

      await this.usersRepository.save(user);
      return user;
    } catch (error: any) {
      this.logger.error(`Error updating user energy for ${userId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при обновлении энергии пользователя: ${error.message}`);
    }
  }

  async updateUserLives(userId: string, data: {
    lives?: number;
    maxLives?: number;
  }) {
    try {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Пользователь не найден');
      }

      if (data.lives !== undefined && data.lives !== null) {
        const livesValue = typeof data.lives === 'number' ? data.lives : parseInt(String(data.lives)) || 0;
        user.lives = Math.max(0, Math.floor(livesValue));
      }
      if (data.maxLives !== undefined && data.maxLives !== null) {
        const maxLivesValue = typeof data.maxLives === 'number' ? data.maxLives : parseInt(String(data.maxLives)) || 100;
        user.maxLives = Math.max(1, Math.floor(maxLivesValue));
      }

      await this.usersRepository.save(user);
      return user;
    } catch (error: any) {
      this.logger.error(`Error updating user lives for ${userId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при обновлении жизней пользователя: ${error.message}`);
    }
  }

  async updateUserSkillPoints(userId: string, data: {
    skillPoints?: number;
    freeSkillPoints?: number;
    economySp?: number;
    energySp?: number;
    livesSp?: number;
    powerSp?: number;
  }) {
    try {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Пользователь не найден');
      }

      if (data.skillPoints !== undefined && data.skillPoints !== null) {
        const value = typeof data.skillPoints === 'number' ? data.skillPoints : parseInt(String(data.skillPoints)) || 0;
        user.skillPoints = Math.max(0, Math.floor(value));
      }
      if (data.freeSkillPoints !== undefined && data.freeSkillPoints !== null) {
        const value = typeof data.freeSkillPoints === 'number' ? data.freeSkillPoints : parseInt(String(data.freeSkillPoints)) || 0;
        user.freeSkillPoints = Math.max(0, Math.floor(value));
      }
      if (data.economySp !== undefined && data.economySp !== null) {
        const value = typeof data.economySp === 'number' ? data.economySp : parseInt(String(data.economySp)) || 0;
        user.economySp = Math.max(0, Math.floor(value));
      }
      if (data.energySp !== undefined && data.energySp !== null) {
        const value = typeof data.energySp === 'number' ? data.energySp : parseInt(String(data.energySp)) || 0;
        user.energySp = Math.max(0, Math.floor(value));
      }
      if (data.livesSp !== undefined && data.livesSp !== null) {
        const value = typeof data.livesSp === 'number' ? data.livesSp : parseInt(String(data.livesSp)) || 0;
        user.livesSp = Math.max(0, Math.floor(value));
      }
      if (data.powerSp !== undefined && data.powerSp !== null) {
        const value = typeof data.powerSp === 'number' ? data.powerSp : parseInt(String(data.powerSp)) || 0;
        user.powerSp = Math.max(0, Math.floor(value));
      }

      await this.usersRepository.save(user);
      return user;
    } catch (error: any) {
      this.logger.error(`Error updating user skill points for ${userId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Ошибка при обновлении skill points пользователя: ${error.message}`);
    }
  }

  async updateUserEnhancement(userId: string, data: {
    enhancement?: string;
  }) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (data.enhancement !== undefined) {
      const validEnhancements = ['economy', 'energy', 'lives', 'power'];
      if (!validEnhancements.includes(data.enhancement)) {
        throw new BadRequestException(`Недопустимое значение enhancement. Допустимые: ${validEnhancements.join(', ')}`);
      }
      user.enhancement = data.enhancement;
    }

    await this.usersRepository.save(user);
    return user;
  }

  async updateUserBusinessLicense(userId: string, data: {
    hasBusinessLicense?: boolean;
  }) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (data.hasBusinessLicense !== undefined) user.hasBusinessLicense = data.hasBusinessLicense;

    await this.usersRepository.save(user);
    return user;
  }

  async updateUserStatus(userId: string, data: {
    isBanned?: boolean;
    banReason?: string;
    isAdmin?: boolean;
    isGuest?: boolean;
  }) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (data.isBanned !== undefined) {
      user.isBanned = data.isBanned;
      if (!data.isBanned) {
        user.banReason = null;
      }
    }
    if (data.banReason !== undefined) user.banReason = data.banReason;
    if (data.isAdmin !== undefined) user.isAdmin = data.isAdmin;
    if (data.isGuest !== undefined) user.isGuest = data.isGuest;

    await this.usersRepository.save(user);
    return user;
  }

  // ========== УПРАВЛЕНИЕ ЦЕНАМИ ==========
  async getSubscriptionPrices() {
    const setting = await this.systemSettingsRepository.findOne({ where: { key: 'subscription_prices' } });
    if (setting) {
      return JSON.parse(setting.value);
    }
    // Дефолтные цены
    return {
      month_1: 3,
      month_3: 7,
      month_12: 22,
    };
  }

  async updateSubscriptionPrices(prices: { month_1?: number; month_3?: number; month_12?: number }) {
    let setting = await this.systemSettingsRepository.findOne({ where: { key: 'subscription_prices' } });
    const currentPrices = setting ? JSON.parse(setting.value) : { month_1: 3, month_3: 7, month_12: 22 };
    
    const updatedPrices = { ...currentPrices, ...prices };
    
    if (!setting) {
      setting = this.systemSettingsRepository.create({
        key: 'subscription_prices',
        value: JSON.stringify(updatedPrices),
      });
    } else {
      setting.value = JSON.stringify(updatedPrices);
    }
    
    await this.systemSettingsRepository.save(setting);
    return updatedPrices;
  }

  async getNarCoinPrices() {
    const setting = await this.systemSettingsRepository.findOne({ where: { key: 'nar_coin_packages' } });
    if (setting) {
      return JSON.parse(setting.value);
    }
    return [];
  }

  async updateNarCoinPrices(packages: Array<{ amount: number; price: number }>) {
    let setting = await this.systemSettingsRepository.findOne({ where: { key: 'nar_coin_packages' } });
    
    if (!setting) {
      setting = this.systemSettingsRepository.create({
        key: 'nar_coin_packages',
        value: JSON.stringify(packages),
      });
    } else {
      setting.value = JSON.stringify(packages);
    }
    
    await this.systemSettingsRepository.save(setting);
    return packages;
  }

  // ========== СИСТЕМНЫЕ НАСТРОЙКИ ==========
  async getSystemSettings() {
    const settings = await this.systemSettingsRepository.find();
    const result: Record<string, any> = {};
    settings.forEach(s => {
      try {
        result[s.key] = JSON.parse(s.value);
      } catch {
        result[s.key] = s.value;
      }
    });
    return result;
  }

  async updateSystemSettings(settings: Record<string, any>) {
    for (const [key, value] of Object.entries(settings)) {
      let setting = await this.systemSettingsRepository.findOne({ where: { key } });
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (!setting) {
        setting = this.systemSettingsRepository.create({ key, value: stringValue });
      } else {
        setting.value = stringValue;
      }
      
      await this.systemSettingsRepository.save(setting);
    }
    return this.getSystemSettings();
  }

  // ========== КУРСЫ (ПОЛНОЕ РЕДАКТИРОВАНИЕ) ==========
  async updateCourseFull(id: string, data: Partial<CourseTask>) {
    const course = await this.courseTasksRepository.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException('Курс не найден');
    }

    Object.assign(course, data);
    await this.courseTasksRepository.save(course);
    return course;
  }

  // ========== СТАТИСТИКА ==========
  async getStatistics() {
    const [
      totalUsers,
      activeUsers,
      totalGames,
      finishedGames,
      totalTournaments,
      activeTournaments,
      totalQuests,
      activeQuests,
      totalSkins,
      totalTransactions,
      completedTransactions,
      totalNarCoin,
      totalXp,
    ] = await Promise.all([
      this.usersRepository.count(),
      this.usersRepository.count({ where: { isBanned: false } }),
      this.gamesRepository.count(),
      this.gamesRepository.count({ where: { status: GameStatus.FINISHED } }),
      this.tournamentsRepository.count(),
      this.tournamentsRepository.count({ where: { status: TournamentStatus.IN_PROGRESS } }),
      this.questsRepository.count(),
      this.questsRepository.count({ where: { startDate: LessThan(new Date()), endDate: MoreThan(new Date()) } }),
      this.skinsRepository.count(),
      this.paymentTransactionsRepository.count(),
      this.paymentTransactionsRepository.count({ where: { status: PaymentStatus.COMPLETED } }),
      this.usersRepository
        .createQueryBuilder('user')
        .select('SUM(user.narCoin)', 'total')
        .getRawOne()
        .then(r => r?.total || '0'),
      this.usersRepository
        .createQueryBuilder('user')
        .select('SUM(user.xp)', 'total')
        .getRawOne()
        .then(r => r?.total || '0'),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers },
      games: { total: totalGames, finished: finishedGames },
      tournaments: { total: totalTournaments, active: activeTournaments },
      quests: { total: totalQuests, active: activeQuests },
      skins: { total: totalSkins },
      transactions: { total: totalTransactions, completed: completedTransactions },
      economy: { totalNarCoin, totalXp },
    };
  }

  async getGameReplay(gameId: string, step?: number) {
    // Админы могут просматривать любую игру без проверки доступа
    return this.historyService.getGameReplay(gameId, step);
  }

  async deleteAllBotNotifications() {
    // Удаляем все уведомления типа 'info', которые обычно отправляются ботом
    await this.notificationsRepository.delete({ type: 'info' });
    return { message: 'Все сообщения бота удалены' };
  }

  async deleteLastBotNotifications() {
    // Удаляем последнее сообщение бота у каждого пользователя
    const users = await this.usersRepository.find({ select: ['id'] });
    
    for (const user of users) {
      const lastBotNotification = await this.notificationsRepository.findOne({
        where: { userId: user.id, type: 'info' },
        order: { createdAt: 'DESC' },
      });
      
      if (lastBotNotification) {
        await this.notificationsRepository.delete({ id: lastBotNotification.id });
      }
    }
    
    return { message: 'Последние сообщения бота удалены' };
  }
}

