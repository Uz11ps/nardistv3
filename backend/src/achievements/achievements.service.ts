import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement, AchievementType } from './achievement.entity';
import { UserAchievement } from './user-achievement.entity';
import { UsersService } from '../users/users.service';
import { ProgressService } from '../progress/progress.service';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(Achievement)
    private achievementsRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private userAchievementsRepository: Repository<UserAchievement>,
    private usersService: UsersService,
    private progressService: ProgressService,
  ) {}

  async getUserAchievements(userId: string, filter?: string): Promise<any[]> {
    // Получаем все достижения
    const allAchievements = await this.achievementsRepository.find({
      order: { createdAt: 'ASC' },
    });

    // Получаем прогресс пользователя для каждого достижения
    const result = [];
    for (const achievement of allAchievements) {
      let userAchievement = await this.userAchievementsRepository.findOne({
        where: { userId, achievementId: achievement.id },
      });

      if (!userAchievement) {
        // Создаем запись прогресса если её нет
        userAchievement = this.userAchievementsRepository.create({
          userId,
          achievementId: achievement.id,
          progress: 0,
          maxProgress: achievement.targetValue,
          unlocked: false,
          claimed: false,
        });
        userAchievement = await this.userAchievementsRepository.save(userAchievement);
      }

      // Вычисляем текущий прогресс на основе типа достижения
      const currentProgress = await this.calculateProgress(userId, achievement.type);
      userAchievement.progress = currentProgress;

      // Проверяем, разблокировано ли достижение
      if (!userAchievement.unlocked && currentProgress >= achievement.targetValue) {
        userAchievement.unlocked = true;
        userAchievement.unlockedAt = new Date();
        await this.userAchievementsRepository.save(userAchievement);
      }

      result.push({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        progress: userAchievement.progress,
        maxProgress: achievement.targetValue,
        unlocked: userAchievement.unlocked,
        unlockedAt: userAchievement.unlockedAt,
        reward: achievement.reward,
      });
    }

    return result;
  }

  private async calculateProgress(userId: string, type: AchievementType): Promise<number> {
    const user = await this.usersService.findOne(userId);
    
    switch (type) {
      case AchievementType.WINS:
        // Получаем количество побед из рейтинга
        // TODO: можно добавить отдельное поле в User или считать из Game
        return 0; // Временно, нужно реализовать подсчет побед
      
      case AchievementType.STREAK:
        // TODO: реализовать подсчет серии побед
        return 0;
      
      case AchievementType.LEVEL:
        return user.level || 1;
      
      case AchievementType.GAMES_PLAYED:
        // TODO: считать из Game
        return 0;
      
      case AchievementType.TOURNAMENT:
        // TODO: считать участие в турнирах
        return 0;
      
      case AchievementType.CLAN:
        // TODO: проверять участие в клане
        return 0;
      
      default:
        return 0;
    }
  }

  async claimAchievement(userId: string, achievementId: string): Promise<void> {
    const userAchievement = await this.userAchievementsRepository.findOne({
      where: { userId, achievementId },
      relations: ['achievement'],
    });

    if (!userAchievement || !userAchievement.unlocked || userAchievement.claimed) {
      throw new Error('Достижение не может быть получено');
    }

    // Выдаем награду
    if (userAchievement.achievement.reward) {
      const reward = userAchievement.achievement.reward;
      if (reward.type === 'narCoin') {
        await this.progressService.addNarCoin(userId, reward.amount);
      } else if (reward.type === 'xp') {
        await this.progressService.addXP(userId, reward.amount);
      }
      // TODO: обработка награды типа 'skin'
    }

    userAchievement.claimed = true;
    await this.userAchievementsRepository.save(userAchievement);
  }
}

