import { Injectable, Inject, forwardRef, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrainingPosition } from './training-position.entity';
import { UserTrainingProgress } from './user-training-progress.entity';
import { TrainingTask, TaskType } from './training-task.entity';
import { UserTaskProgress } from './user-task-progress.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';
import { UsersService } from '../users/users.service';
import { ProgressService } from '../progress/progress.service';

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(TrainingPosition)
    private positionsRepository: Repository<TrainingPosition>,
    @InjectRepository(UserTrainingProgress)
    private progressRepository: Repository<UserTrainingProgress>,
    @InjectRepository(TrainingTask)
    private tasksRepository: Repository<TrainingTask>,
    @InjectRepository(UserTaskProgress)
    private taskProgressRepository: Repository<UserTaskProgress>,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
    private backgammonEngine: BackgammonEngine,
    private longBackgammonEngine: LongBackgammonEngine,
    private usersService: UsersService,
    private progressService: ProgressService,
  ) {}

  /**
   * Получить список позиций для тренажера
   */
  async getPositions(userId?: string, difficulty?: number): Promise<any[]> {
    const hasPremium = userId ? await this.subscriptionService.hasActiveSubscription(userId) : false;

    const query = this.positionsRepository.createQueryBuilder('position');

    if (!hasPremium) {
      query.where('position.isPremium = :isPremium', { isPremium: false });
    }

    if (difficulty) {
      query.andWhere('position.difficulty = :difficulty', { difficulty });
    }

    const positions = await query.orderBy('position.difficulty', 'ASC').getMany();

    // Получаем прогресс пользователя
    const userProgress = userId
      ? await this.progressRepository.find({
          where: { userId },
          select: ['positionId', 'completed', 'attempts'],
        })
      : [];

    const progressMap = new Map(userProgress.map((p) => [p.positionId, p]));

    return positions.map((pos) => {
      const progress = progressMap.get(pos.id);
      return {
        id: pos.id,
        title: pos.title,
        description: pos.description,
        mode: pos.mode,
        difficulty: pos.difficulty,
        isPremium: pos.isPremium,
        completed: progress?.completed || false,
        attempts: progress?.attempts || 0,
      };
    });
  }

  /**
   * Получить позицию по ID
   */
  async getPosition(userId: string, positionId: string): Promise<any> {
    const position = await this.positionsRepository.findOne({ where: { id: positionId } });
    if (!position) {
      throw new NotFoundException('Позиция не найдена');
    }

    // Проверка премиум для премиум позиций
    if (position.isPremium) {
      const hasPremium = await this.subscriptionService.hasActiveSubscription(userId);
      if (!hasPremium) {
        throw new ForbiddenException('Премиум позиции доступны только для подписчиков');
      }
    }

    const progress = await this.progressRepository.findOne({
      where: { userId, positionId },
    });

    return {
      ...position,
      progress: progress
        ? {
            completed: progress.completed,
            attempts: progress.attempts,
            lastMove: progress.lastMove,
          }
        : null,
    };
  }

  /**
   * Проверить решение позиции
   */
  async checkSolution(
    userId: string,
    positionId: string,
    move: Array<{ from: number; to: number; die: number }>,
  ): Promise<{ correct: boolean; feedback?: string }> {
    const position = await this.positionsRepository.findOne({ where: { id: positionId } });
    if (!position) {
      throw new NotFoundException('Позиция не найдена');
    }

    const engine = position.mode === 'short' ? this.backgammonEngine : this.longBackgammonEngine;

    // Проверяем валидность хода
    let isValid = true;
    let testState = { ...position.position };

    try {
      for (const m of move) {
        if (!engine.validateMove(testState, m.from, m.to, m.die)) {
          isValid = false;
          break;
        }
        testState = engine.applyMove(testState, m.from, m.to, m.die);
      }
    } catch (e) {
      isValid = false;
    }

    // Проверяем, является ли ход правильным решением
    const bestMoves = position.bestMoves || [];
    const isCorrect = isValid && bestMoves.some((bestMove) => {
      // Упрощенная проверка - сравниваем структуру хода
      if (bestMove.length !== move.length) return false;
      return bestMove.every((bm: any, idx: number) => {
        const m = move[idx];
        return bm.from === m.from && bm.to === m.to && bm.die === m.die;
      });
    });

    // Обновляем прогресс
    let progress = await this.progressRepository.findOne({
      where: { userId, positionId },
    });

    if (!progress) {
      progress = this.progressRepository.create({
        userId,
        positionId,
        attempts: 1,
        completed: isCorrect,
        lastMove: move,
        completedAt: isCorrect ? new Date() : null,
      });
    } else {
      progress.attempts++;
      progress.lastMove = move;
      if (isCorrect && !progress.completed) {
        progress.completed = true;
        progress.completedAt = new Date();
      }
    }
    await this.progressRepository.save(progress);

    return {
      correct: isCorrect,
      feedback: isCorrect
        ? 'Отлично! Правильное решение.'
        : isValid
          ? 'Ход валиден, но есть более сильное решение.'
          : 'Недопустимый ход. Попробуйте еще раз.',
    };
  }

  async getTasks(userId: string): Promise<any[]> {
    const tasks = await this.tasksRepository.find({
      order: { order: 'ASC' },
    });

    const result = [];
    for (const task of tasks) {
      let progress = await this.taskProgressRepository.findOne({
        where: { userId, taskId: task.id },
      });

      if (!progress) {
        progress = this.taskProgressRepository.create({
          userId,
          taskId: task.id,
          progress: 0,
          completed: false,
          claimed: false,
        });
        progress = await this.taskProgressRepository.save(progress);
      }

      result.push({
        id: task.id,
        title: task.title,
        description: task.description,
        type: task.type,
        targetValue: task.targetValue,
        rewardNarCoin: Number(task.rewardNarCoin),
        rewardXP: task.rewardXP,
        progress: progress.progress,
        completed: progress.completed,
        claimed: progress.claimed,
        isPremium: task.isPremium,
      });
    }

    return result;
  }

  async updateTaskProgress(userId: string, taskType: TaskType, amount: number = 1): Promise<void> {
    const tasks = await this.tasksRepository.find({
      where: { type: taskType },
    });

    for (const task of tasks) {
      let progress = await this.taskProgressRepository.findOne({
        where: { userId, taskId: task.id },
      });

      if (!progress) {
        progress = this.taskProgressRepository.create({
          userId,
          taskId: task.id,
          progress: 0,
          completed: false,
          claimed: false,
        });
      }

      if (!progress.completed) {
        progress.progress += amount;
        if (progress.progress >= task.targetValue) {
          progress.completed = true;
          progress.completedAt = new Date();
        }
        await this.taskProgressRepository.save(progress);
      }
    }
  }

  async claimTaskReward(userId: string, taskId: string): Promise<void> {
    const progress = await this.taskProgressRepository.findOne({
      where: { userId, taskId },
      relations: ['task'],
    });

    if (!progress || !progress.completed || progress.claimed) {
      throw new ForbiddenException('Задание не может быть получено');
    }

    const task = progress.task;
    
    // Начисляем награды
    if (task.rewardNarCoin && Number(task.rewardNarCoin) > 0) {
      await this.progressService.addNarCoin(userId, Number(task.rewardNarCoin));
    }
    
    if (task.rewardXP > 0) {
      await this.progressService.addXP(userId, task.rewardXP);
    }

    progress.claimed = true;
    await this.taskProgressRepository.save(progress);
  }
}

