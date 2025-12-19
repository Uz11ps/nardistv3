import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { AcademyService } from '../academy/academy.service';
import { SkinsService } from '../skins/skins.service';
import { GamesService } from '../games/games.service';
import { User } from '../users/user.entity';
import { Game } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
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
    private usersService: UsersService,
    private tournamentsService: TournamentsService,
    private academyService: AcademyService,
    private skinsService: SkinsService,
    private gamesService: GamesService,
    private configService: ConfigService,
  ) {}

  async getStats() {
    const totalUsers = await this.usersRepository.count();
    const activeUsers = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.updatedAt > :date', { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
      .getCount();
    
    const totalGames = await this.gamesRepository.count();
    const finishedGames = await this.gamesRepository.count({ where: { status: 'finished' } });
    const inProgressGames = await this.gamesRepository.count({ where: { status: 'in_progress' } });
    
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
}

