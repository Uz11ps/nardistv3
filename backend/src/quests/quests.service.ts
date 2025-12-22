import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quest, QuestType, QuestTarget } from './quest.entity';
import { QuestProgress } from './quest-progress.entity';
import { ProgressService } from '../progress/progress.service';

@Injectable()
export class QuestsService {
  constructor(
    @InjectRepository(Quest)
    private questsRepository: Repository<Quest>,
    @InjectRepository(QuestProgress)
    private progressRepository: Repository<QuestProgress>,
    private progressService: ProgressService,
  ) {}

  async getActiveQuests(userId: string): Promise<any[]> {
    const now = new Date();
    const quests = await this.questsRepository
      .createQueryBuilder('quest')
      .where('quest.startDate <= :now', { now })
      .andWhere('quest.endDate >= :now', { now })
      .andWhere('(quest.type = :daily OR quest.type = :weekly OR quest.type = :special)', {
        daily: QuestType.DAILY,
        weekly: QuestType.WEEKLY,
        special: QuestType.SPECIAL,
      })
      .getMany();

    const result = [];
    for (const quest of quests) {
      let progress = await this.progressRepository.findOne({
        where: { userId, questId: quest.id },
      });

      if (!progress) {
        progress = this.progressRepository.create({
          userId,
          questId: quest.id,
          progress: 0,
          completed: false,
        });
        progress = await this.progressRepository.save(progress);
      }

      result.push({
        ...quest,
        progress: progress.progress,
        completed: progress.completed,
      });
    }

    return result;
  }

  async getQuestsByType(userId: string, type: string): Promise<any> {
    const now = new Date();
    let questType: QuestType | null = null;
    if (type === 'daily') {
      questType = QuestType.DAILY;
    } else if (type === 'weekly') {
      questType = QuestType.WEEKLY;
    } else if (type === 'special') {
      questType = QuestType.SPECIAL;
    }
    
    if (!questType) {
      return { quests: [], resetTime: '' };
    }

    const quests = await this.questsRepository.find({
      where: { type: questType },
      order: { createdAt: 'ASC' },
    });

    const result = [];
    for (const quest of quests) {
      let progress = await this.progressRepository.findOne({
        where: { userId, questId: quest.id },
      });

      if (!progress) {
        progress = this.progressRepository.create({
          userId,
          questId: quest.id,
          progress: 0,
          completed: false,
          claimed: false,
        });
        progress = await this.progressRepository.save(progress);
      }

      result.push({
        id: quest.id,
        name: quest.name,
        description: quest.description,
        rewardNarCoin: Number(quest.rewardNarCoin),
        rewardXP: quest.rewardXP,
        progress: progress.progress,
        target: quest.targetValue,
        completed: progress.completed,
        claimed: progress.claimed || false,
        isPremium: quest.isPremium || false,
      });
    }

    // Вычисляем время до сброса
    let resetTime = '';
    if (type === 'daily') {
      // Сброс ежедневных квестов в 00:00 следующего дня
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      resetTime = `${hours}ч`;
    } else if (type === 'weekly') {
      // Сброс недельных квестов в понедельник в 00:00
      const nextMonday = new Date();
      const daysUntilMonday = (8 - nextMonday.getDay()) % 7 || 7;
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
      nextMonday.setHours(0, 0, 0, 0);
      const diff = nextMonday.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      resetTime = days > 0 ? `${days}д ${hours}ч` : `${hours}ч`;
    } else if (type === 'special') {
      // Особые квесты не имеют фиксированного времени сброса
      resetTime = '';
    }
    return { quests: result, resetTime };
  }

  async claimQuest(userId: string, questId: string): Promise<void> {
    const progress = await this.progressRepository.findOne({
      where: { userId, questId },
      relations: ['quest'],
    });

    if (!progress || !progress.completed || progress.claimed) {
      throw new Error('Задание не может быть получено');
    }

    progress.claimed = true;
    await this.progressRepository.save(progress);
  }

  async updateProgress(userId: string, target: QuestTarget | string, amount: number = 1): Promise<void> {
    const now = new Date();
    const quests = await this.questsRepository
      .createQueryBuilder('quest')
      .where('quest.target = :target', { target })
      .andWhere('quest.startDate <= :now', { now })
      .andWhere('quest.endDate >= :now', { now })
      .andWhere('(quest.type = :daily OR quest.type = :weekly OR quest.type = :special)', {
        daily: QuestType.DAILY,
        weekly: QuestType.WEEKLY,
        special: QuestType.SPECIAL,
      })
      .getMany();

    for (const quest of quests) {
      let progress = await this.progressRepository.findOne({
        where: { userId, questId: quest.id },
      });

      if (!progress) {
        progress = this.progressRepository.create({
          userId,
          questId: quest.id,
          progress: 0,
          completed: false,
          claimed: false,
        });
      }

      if (!progress.completed) {
        progress.progress += amount;
        if (progress.progress >= quest.targetValue) {
          progress.completed = true;
        }
        await this.progressRepository.save(progress);
      }
    }
  }
}

