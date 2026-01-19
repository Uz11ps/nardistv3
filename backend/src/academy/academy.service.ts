import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Article } from './article.entity';
import { UserMaterial } from './user-material.entity';
import { ArticleSlot } from './article-slot.entity';
import { CourseTask } from './course-task.entity';
import { CourseTaskProgress } from './course-task-progress.entity';
import { UsersService } from '../users/users.service';
import { AdminService } from '../admin/admin.service';

@Injectable()
export class AcademyService {
  constructor(
    @InjectRepository(Article)
    private articlesRepository: Repository<Article>,
    @InjectRepository(UserMaterial)
    private userMaterialsRepository: Repository<UserMaterial>,
    @InjectRepository(ArticleSlot)
    private articleSlotsRepository: Repository<ArticleSlot>,
    @InjectRepository(CourseTask)
    private courseTasksRepository: Repository<CourseTask>,
    @InjectRepository(CourseTaskProgress)
    private courseTaskProgressRepository: Repository<CourseTaskProgress>,
    private usersService: UsersService,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
  ) {}

  async findAll(): Promise<Article[]> {
    return this.articlesRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId?: string): Promise<Article & { purchased?: boolean; sections?: any[] }> {
    const article = await this.articlesRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException('Статья не найдена');
    }

    // Проверяем доступность материала
    let purchased = false;
    let userMaterial = null;
    if (!article.isPaid) {
      purchased = true; // Бесплатные материалы доступны всем
    } else if (userId) {
      // Проверяем, куплен ли платный материал
      userMaterial = await this.userMaterialsRepository.findOne({
        where: { userId, articleId: id },
      });
      purchased = !!userMaterial;
    }

    article.views++;
    await this.articlesRepository.save(article);

    // Формируем базовый результат
    const result: any = { 
      id: article.id,
      title: article.title,
      author: article.author,
      type: article.type,
      price: Number(article.price || 0),
      isPaid: article.isPaid,
      views: article.views,
      gameMode: article.gameMode,
      purchased,
    };
    
    // Контент, sections и quiz возвращаем только если материал куплен или бесплатный
    if (purchased) {
      // Если есть content, добавляем его в результат
      if (article.content) {
        result.content = article.content;
      }

      // Если это курс или онбординг, загружаем задания как sections
      if (article.type === 'course' || article.type === 'onboarding') {
        const tasks = await this.courseTasksRepository.find({
          where: { courseId: id, isActive: true },
          order: { order: 'ASC' },
        });

        // Преобразуем задания в sections
        result.sections = tasks.map((task, index) => ({
          id: task.id,
          title: task.title,
          description: task.description || '',
          content: task.description || '', // Используем description как content для отображения
          icon: this.getTaskIcon(task.type),
          order: task.order || index,
          type: task.type,
          requirements: task.requirements,
          rewardNarCoin: Number(task.rewardNarCoin || 0),
          rewardXP: task.rewardXP || 0,
          isRequired: task.isRequired,
        }));

        // Если sections пустые, используем content как fallback
        if (result.sections.length === 0 && article.content) {
          result.sections = [{
            id: 'main',
            title: article.type === 'onboarding' ? 'Содержание онбординга' : 'Содержание курса',
            content: article.content,
            order: 0,
          }];
        }

        // Добавляем quiz из assignment, если он есть
        if (article.assignment && article.assignment.quiz) {
          result.quiz = article.assignment.quiz;
          // Если курс куплен, проверяем статус прохождения теста
          if (userMaterial) {
            result.quizPassed = userMaterial.quizPassed || false;
            result.quizPassedAt = userMaterial.quizPassedAt || null;
          }
        }
      }
    }

    return result;
  }

  private getTaskIcon(taskType: string): string {
    const icons: Record<string, string> = {
      'train_with_bot': '🤖',
      'online_match': '🎮',
      'view_city': '🏙️',
      'play_short_match': '⚡',
      'play_long_match': '🎲',
      'win_match': '🏆',
      'complete_training_position': '✅',
      'join_clan': '👥',
      'purchase_building': '🏗️',
      'upgrade_building': '⬆️',
      'custom': '📝',
    };
    return icons[taskType] || '📋';
  }

  async create(articleData: Partial<Article>, isAdmin: boolean = false): Promise<Article> {
    const article = this.articlesRepository.create({
      ...articleData,
      isApproved: isAdmin, // Статьи администратора автоматически одобрены
      isVerified: isAdmin, // Статьи администратора также сразу верифицированы
    });
    return this.articlesRepository.save(article);
  }

  async update(id: string, articleData: Partial<Article>): Promise<Article> {
    const article = await this.articlesRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException('Статья не найдена');
    }
    Object.assign(article, articleData);
    return this.articlesRepository.save(article);
  }

  async delete(id: string): Promise<void> {
    await this.articlesRepository.delete(id);
  }

  async getCourses(userId?: string): Promise<any[]> {
    // Показываем только верифицированные курсы или курсы администраторов
    const articles = await this.articlesRepository.find({
      where: { type: 'course' },
      order: { createdAt: 'DESC' },
    });

    // Фильтруем: показываем только верифицированные курсы или курсы без authorId (от админов)
    const visibleCourses = articles.filter(
      (article) => article.isVerified || !article.authorId
    );

    // Получаем купленные материалы пользователя, если userId передан
    const purchasedArticleIds = userId
      ? (await this.userMaterialsRepository.find({
          where: { userId },
          select: ['articleId'],
        })).map((um) => um.articleId)
      : [];

    // Проверяем выполнение для каждого курса
    const result = [];
    for (const article of visibleCourses) {
      const purchased = purchasedArticleIds.includes(article.id);
      let isCompleted = false;

      if (purchased && userId) {
        // Проверяем, выполнены ли все задания курса
        const tasks = await this.courseTasksRepository.find({
          where: { courseId: article.id, isActive: true },
        });

        if (tasks.length > 0) {
          const taskIds = tasks.map(t => t.id);
          const completedTasks = await this.courseTaskProgressRepository.find({
            where: {
              userId,
              taskId: In(taskIds),
              isCompleted: true,
            },
          });
          isCompleted = completedTasks.length === tasks.length;
        }
      }

      result.push({
        id: article.id,
        title: article.title,
        author: article.author,
        price: Number(article.price || 0),
        purchased,
        isPaid: article.isPaid,
        views: article.views,
        isVerified: article.isVerified,
        isCompleted,
        gameMode: article.gameMode,
        assignment: article.assignment, // Добавляем assignment для проверки наличия quiz
      });
    }

    return result;
  }

  async getArticles(userId?: string, includePending: boolean = false): Promise<any[]> {
    const query = this.articlesRepository.createQueryBuilder('article')
      .where('article.type = :type', { type: 'article' });
    
    // Если не администратор, показываем только одобренные или верифицированные статьи
    if (!includePending) {
      query.andWhere('(article.isApproved = true OR article.isVerified = true)');
    }
    
    query.orderBy('article.createdAt', 'DESC');
    const articles = await query.getMany();

    // Получаем купленные материалы пользователя, если userId передан
    const purchasedArticleIds = userId
      ? (await this.userMaterialsRepository.find({
          where: { userId },
          select: ['articleId'],
        })).map((um) => um.articleId)
      : [];

    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      author: article.author,
      price: Number(article.price || 0),
      purchased: purchasedArticleIds.includes(article.id),
      isPaid: article.isPaid,
      views: article.views,
      isCompleted: false, // Статьи нельзя выполнить
      gameMode: article.gameMode,
      isApproved: article.isApproved,
      isVerified: article.isVerified,
    }));
  }

  async getOnboarding(userId?: string): Promise<any[]> {
    // Онбординг всегда бесплатный, но проверяем доступ
    const articles = await this.articlesRepository.find({
      where: { type: 'onboarding' },
      order: { createdAt: 'DESC' },
    });

    // Получаем купленные материалы пользователя (для онбординга это всегда true, т.к. бесплатный)
    const purchasedArticleIds = userId
      ? (await this.userMaterialsRepository.find({
          where: { userId },
          select: ['articleId'],
        })).map((um) => um.articleId)
      : [];

    // Проверяем выполнение для каждого онбординга
    const result = [];
    for (const article of articles) {
      // Онбординг всегда бесплатный, но проверяем запись в user_materials (если есть)
      // Если онбординг бесплатный, он доступен всем (purchased = true)
      const purchased = !article.isPaid || purchasedArticleIds.includes(article.id);
      let isCompleted = false;

      if (purchased && userId) {
        // Проверяем, выполнены ли все задания онбординга
        const tasks = await this.courseTasksRepository.find({
          where: { courseId: article.id, isActive: true },
        });

        if (tasks.length > 0) {
          const taskIds = tasks.map(t => t.id);
          const completedTasks = await this.courseTaskProgressRepository.find({
            where: {
              userId,
              taskId: In(taskIds),
              isCompleted: true,
            },
          });
          isCompleted = completedTasks.length === tasks.length;
        }
      }

      result.push({
        id: article.id,
        title: article.title,
        author: article.author,
        price: 0, // Онбординг бесплатный
        purchased,
        isPaid: false,
        views: article.views,
        isCompleted,
        gameMode: article.gameMode,
      });
    }

    return result;
  }

  async getUserMaterials(userId: string): Promise<any[]> {
    const userMaterials = await this.userMaterialsRepository.find({
      where: { userId },
      relations: ['article'],
      order: { purchasedAt: 'DESC' },
    });

    return userMaterials.map((um) => ({
      id: um.article.id,
      title: um.article.title,
      author: um.article.author,
      type: um.article.type,
      pricePaid: Number(um.pricePaid),
      purchasedAt: um.purchasedAt.toISOString(),
      views: um.article.views,
    }));
  }

  async purchaseCourse(userId: string, courseId: string): Promise<void> {
    const course = await this.findOne(courseId);
    const user = await this.usersService.findOne(userId);

    // Проверяем, не куплен ли уже материал
    const existing = await this.userMaterialsRepository.findOne({
      where: { userId, articleId: courseId },
    });

    if (existing) {
      throw new BadRequestException('Материал уже куплен');
    }

    const price = Number(course.price || 0);
    
    // Если материал платный (цена > 0), проверяем баланс и списываем средства
    if (price > 0) {
      if (Number(user.narCoin) < price) {
        throw new BadRequestException('Недостаточно NAR-coin');
      }

      // Списываем средства
      const userBalance = Number(user.narCoin);
      const newBalance = userBalance - price;
      await this.usersService.update(userId, { narCoin: newBalance });

      // Получаем процент роялти из настроек системы
      const royaltyPercentStr = await this.adminService.getSystemSetting('course_royalty_percent', '20');
      const royaltyPercentValue = parseInt(royaltyPercentStr) || 20;

      // Вычисляем роялти для автора курса (если курс создан игроком)
      if (course.authorId && course.authorId !== userId) {
        const authorRoyalty = Math.floor(price * (royaltyPercentValue / 100));
        const author = await this.usersService.findOne(course.authorId);
        if (author) {
          const authorBalance = Number(author.narCoin);
          const newAuthorBalance = authorBalance + authorRoyalty;
          await this.usersService.update(course.authorId, { narCoin: newAuthorBalance });
        }
      }
      // Остальные (100% - royaltyPercent) остаются в экономике проекта
    }
    // Если материал бесплатный (price === 0), просто открываем доступ без списания средств

    // Сохраняем покупку (или бесплатное получение)
    const userMaterial = this.userMaterialsRepository.create({
      userId,
      articleId: courseId,
      pricePaid: price,
    });
    await this.userMaterialsRepository.save(userMaterial);
  }

  async purchaseArticleSlot(userId: string, price: number = 100000): Promise<ArticleSlot> {
    const user = await this.usersService.findOne(userId);
    
    if (Number(user.narCoin) < price) {
      throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${price}, у вас: ${Number(user.narCoin)}`);
    }

    // Списываем средства
    const userBalance = Number(user.narCoin);
    const newBalance = userBalance - price;
    await this.usersService.update(userId, { narCoin: newBalance });

    // Создаем слот
    const slot = this.articleSlotsRepository.create({
      userId,
      purchasePrice: price.toString(),
      isUsed: false,
    });
    return this.articleSlotsRepository.save(slot);
  }

  async getUserSlots(userId: string): Promise<ArticleSlot[]> {
    return this.articleSlotsRepository.find({
      where: { userId },
      order: { purchasedAt: 'DESC' },
    });
  }

  async createUserArticle(
    userId: string,
    slotId: string,
    articleData: { title: string; content: string; gameMode?: string; telegraphData?: any },
  ): Promise<Article> {
    const slot = await this.articleSlotsRepository.findOne({ where: { id: slotId, userId } });
    if (!slot) {
      throw new NotFoundException('Слот не найден');
    }

    if (slot.isUsed) {
      throw new BadRequestException('Слот уже использован');
    }

    const user = await this.usersService.findOne(userId);

    // Создаем статью (не одобренную, ждет модерации)
    const article = this.articlesRepository.create({
      title: articleData.title,
      content: articleData.content,
      gameMode: articleData.gameMode || 'long',
      telegraphData: articleData.telegraphData,
      author: user.username || user.telegramId?.toString() || 'Пользователь',
      authorId: userId,
      type: 'article',
      isPaid: false,
      price: 0,
      isApproved: false, // Статья требует одобрения администратора
    });
    const savedArticle = await this.articlesRepository.save(article);

    // Обновляем слот
    slot.isUsed = true;
    slot.articleId = savedArticle.id;
    await this.articleSlotsRepository.save(slot);

    return savedArticle;
  }

  async createUserCourse(
    userId: string,
    courseData: { title: string; description?: string; content: string; price: number; gameMode?: string },
  ): Promise<Article> {
    const user = await this.usersService.findOne(userId);

    // Создаем курс - по умолчанию не верифицирован
    const course = this.articlesRepository.create({
      title: courseData.title,
      content: courseData.content || courseData.description || '',
      gameMode: courseData.gameMode || 'long',
      author: user.nickname || user.username || user.telegramId?.toString() || 'Пользователь',
      authorId: userId,
      type: 'course',
      isPaid: courseData.price > 0,
      price: courseData.price,
      isVerified: false, // Требует верификации администратором
    });
    return await this.articlesRepository.save(course);
  }

  async verifyCourse(courseId: string, verifiedBy: string): Promise<Article> {
    const course = await this.articlesRepository.findOne({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Курс не найден');
    }

    course.isVerified = true;
    // Если это статья, также отмечаем как одобренную для отображения в списке
    if (course.type === 'article') {
      course.isApproved = true;
    }
    course.verifiedBy = verifiedBy;
    course.verifiedAt = new Date();
    return this.articlesRepository.save(course);
  }

  async rejectCourse(courseId: string): Promise<void> {
    await this.articlesRepository.delete(courseId);
  }

  async updateUserArticle(
    userId: string,
    articleId: string,
    articleData: { title?: string; content?: string; telegraphData?: any },
  ): Promise<Article> {
    const article = await this.articlesRepository.findOne({ where: { id: articleId, authorId: userId } });
    if (!article) {
      throw new NotFoundException('Статья не найдена или у вас нет прав на её редактирование');
    }

    Object.assign(article, articleData);
    return this.articlesRepository.save(article);
  }

  /**
   * Отправить ответы на тест курса
   */
  async submitQuiz(
    userId: string,
    courseId: string,
    answers: { questionId: number; answer: number }[],
  ): Promise<{ correct: number; total: number; passed: boolean; reward?: any }> {
    const course = await this.articlesRepository.findOne({ where: { id: courseId, type: 'course' } });
    if (!course) {
      throw new NotFoundException('Курс не найден');
    }

    // Проверяем, что курс куплен
    const userMaterial = await this.userMaterialsRepository.findOne({
      where: { userId, articleId: courseId },
    });
    if (!userMaterial) {
      throw new BadRequestException('Курс не куплен');
    }

    // Проверяем наличие теста в assignment
    if (!course.assignment || !course.assignment.quiz || !course.assignment.quiz.questions) {
      throw new BadRequestException('Тест не найден в курсе');
    }

    const quiz = course.assignment.quiz;
    const questions = quiz.questions;
    let correct = 0;

    // Проверяем ответы
    for (const answer of answers) {
      const question = questions.find((q: any) => q.id === answer.questionId);
      if (question && question.correctAnswer === answer.answer) {
        correct++;
      }
    }

    const total = questions.length;
    const passed = correct === total; // Прошел если все ответы правильные

    // Если тест пройден и еще не был пройден ранее, выдаем награду
    const wasAlreadyPassed = userMaterial.quizPassed || false;
    if (passed && !wasAlreadyPassed) {
      userMaterial.quizPassed = true;
      userMaterial.quizPassedAt = new Date();

      // Выдаем награды из курса
      if (course.rewards && course.rewards.length > 0) {
        const user = await this.usersService.findOne(userId);
        for (const reward of course.rewards) {
          if (reward.narCoin) {
            const currentNarCoin = typeof user.narCoin === 'bigint' ? Number(user.narCoin) : (user.narCoin || 0);
            await this.usersService.update(userId, {
              narCoin: currentNarCoin + Number(reward.narCoin),
            });
          }
          if (reward.xp) {
            // XP добавляется через другой механизм, если нужно
          }
        }
      } else if (course.rewardNarCoin) {
        const user = await this.usersService.findOne(userId);
        const currentNarCoin = typeof user.narCoin === 'bigint' ? Number(user.narCoin) : (user.narCoin || 0);
        await this.usersService.update(userId, {
          narCoin: currentNarCoin + Number(course.rewardNarCoin),
        });
      }

      await this.userMaterialsRepository.save(userMaterial);
    }

    return {
      correct,
      total,
      passed,
      reward: passed && !wasAlreadyPassed ? course.rewards || { narCoin: course.rewardNarCoin, xp: course.rewardXP } : undefined,
    };
  }
}

