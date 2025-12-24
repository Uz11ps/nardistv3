import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CourseTask, TaskType } from './course-task.entity';
import { CourseTaskProgress } from './course-task-progress.entity';
import { Article } from './article.entity';
import { UsersService } from '../users/users.service';
import { ProgressService } from '../progress/progress.service';

@Injectable()
export class CourseTasksService {
  constructor(
    @InjectRepository(CourseTask)
    private courseTasksRepository: Repository<CourseTask>,
    @InjectRepository(CourseTaskProgress)
    private courseTaskProgressRepository: Repository<CourseTaskProgress>,
    @InjectRepository(Article)
    private articlesRepository: Repository<Article>,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
  ) {}

  /**
   * Получить все задания курса
   */
  async getCourseTasks(courseId: string, userId?: string) {
    const tasks = await this.courseTasksRepository.find({
      where: { courseId, isActive: true },
      order: { order: 'ASC' },
    });

    if (!userId) {
      return tasks.map((task) => ({
        id: task.id,
        type: task.type,
        title: task.title,
        description: task.description,
        order: task.order,
        requirements: task.requirements,
        rewardNarCoin: Number(task.rewardNarCoin),
        rewardXP: task.rewardXP,
        isRequired: task.isRequired,
        isOnboarding: task.isOnboarding,
        progress: null,
        isCompleted: false,
        isRewardClaimed: false,
      }));
    }

    // Получаем прогресс пользователя
    const progressList = await this.courseTaskProgressRepository.find({
      where: { userId, taskId: In(tasks.map((t) => t.id)) },
    });

    const progressMap = new Map(progressList.map((p) => [p.taskId, p]));

    return tasks.map((task) => {
      const progress = progressMap.get(task.id);
      return {
        id: task.id,
        type: task.type,
        title: task.title,
        description: task.description,
        order: task.order,
        requirements: task.requirements,
        rewardNarCoin: Number(task.rewardNarCoin),
        rewardXP: task.rewardXP,
        isRequired: task.isRequired,
        isOnboarding: task.isOnboarding,
        progress: progress ? progress.progress : 0,
        targetProgress: progress ? progress.targetProgress : (task.requirements?.count || 1),
        isCompleted: progress?.isCompleted || false,
        isRewardClaimed: progress?.isRewardClaimed || false,
        completedAt: progress?.completedAt || null,
      };
    });
  }

  /**
   * Создать задание для курса
   */
  async createTask(courseId: string, taskData: {
    type: TaskType;
    title: string;
    description?: string;
    order?: number;
    requirements?: any;
    rewardNarCoin?: number;
    rewardXP?: number;
    isRequired?: boolean;
    isOnboarding?: boolean;
  }) {
    // Если courseId указан, проверяем что курс существует
    if (courseId) {
      const course = await this.articlesRepository.findOne({ where: { id: courseId } });
      if (!course || course.type !== 'course') {
        throw new NotFoundException('Курс не найден');
      }
    }

    const task = this.courseTasksRepository.create({
      courseId,
      ...taskData,
      order: taskData.order || 0,
      rewardNarCoin: taskData.rewardNarCoin || 0,
      rewardXP: taskData.rewardXP || 0,
      isRequired: taskData.isRequired ?? true,
      isOnboarding: taskData.isOnboarding ?? false,
    });

    return this.courseTasksRepository.save(task);
  }

  /**
   * Обновить прогресс задания
   */
  async updateTaskProgress(
    userId: string,
    taskId: string,
    progressData: {
      progress?: number;
      metadata?: any;
      markCompleted?: boolean;
    },
  ) {
    const task = await this.courseTasksRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Задание не найдено');
    }

    let progress = await this.courseTaskProgressRepository.findOne({
      where: { userId, taskId },
    });

    if (!progress) {
      progress = this.courseTaskProgressRepository.create({
        userId,
        taskId,
        progress: 0,
        targetProgress: task.requirements?.count || 1,
        isCompleted: false,
        isRewardClaimed: false,
      });
    }

    if (progressData.progress !== undefined) {
      progress.progress = progressData.progress;
    }

    if (progressData.metadata) {
      progress.metadata = { ...progress.metadata, ...progressData.metadata };
    }

    // Проверяем, выполнено ли задание
    const targetProgress = progress.targetProgress || task.requirements?.count || 1;
    if (progress.progress >= targetProgress || progressData.markCompleted) {
      if (!progress.isCompleted) {
        progress.isCompleted = true;
        progress.completedAt = new Date();
      }
    }

    await this.courseTaskProgressRepository.save(progress);

    return progress;
  }

  /**
   * Получить награду за выполненное задание
   */
  async claimTaskReward(userId: string, taskId: string) {
    const task = await this.courseTasksRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Задание не найдено');
    }

    const progress = await this.courseTaskProgressRepository.findOne({
      where: { userId, taskId },
    });

    if (!progress || !progress.isCompleted) {
      throw new BadRequestException('Задание не выполнено');
    }

    if (progress.isRewardClaimed) {
      throw new BadRequestException('Награда уже получена');
    }

    // Выдаем награды
    const user = await this.usersService.findOne(userId);
    const newNarCoin = Number(user.narCoin) + Number(task.rewardNarCoin);
    const newXP = Number(user.xp || 0) + task.rewardXP;

    // Обновляем NAR-coin через update, XP через addXP
    await this.usersService.update(userId, {
      narCoin: newNarCoin,
    });
    
    // Начисляем XP через ProgressService
    if (task.rewardXP > 0) {
      await this.progressService.addXP(userId, task.rewardXP);
    }

    // Отмечаем награду как полученную
    progress.isRewardClaimed = true;
    progress.rewardClaimedAt = new Date();
    await this.courseTaskProgressRepository.save(progress);

    return {
      narCoin: Number(task.rewardNarCoin),
      xp: task.rewardXP,
      newBalance: newNarCoin,
      newXP: newXP,
    };
  }

  /**
   * Получить онбординговые задания
   */
  async getOnboardingTasks(userId: string) {
    const onboardingTasks = await this.courseTasksRepository.find({
      where: { isOnboarding: true, isActive: true },
      order: { order: 'ASC' },
    });

    const progressList = await this.courseTaskProgressRepository.find({
      where: { userId, taskId: In(onboardingTasks.map((t) => t.id)) },
    });

    const progressMap = new Map(progressList.map((p) => [p.taskId, p]));

    return onboardingTasks.map((task) => {
      const progress = progressMap.get(task.id);
      return {
        id: task.id,
        type: task.type,
        title: task.title,
        description: task.description,
        order: task.order,
        requirements: task.requirements,
        rewardNarCoin: Number(task.rewardNarCoin),
        rewardXP: task.rewardXP,
        progress: progress ? progress.progress : 0,
        targetProgress: progress ? progress.targetProgress : (task.requirements?.count || 1),
        isCompleted: progress?.isCompleted || false,
        isRewardClaimed: progress?.isRewardClaimed || false,
      };
    });
  }
}

