import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './article.entity';
import { UserMaterial } from './user-material.entity';
import { ArticleSlot } from './article-slot.entity';
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
    private usersService: UsersService,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
  ) {}

  async findAll(): Promise<Article[]> {
    return this.articlesRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId?: string): Promise<Article & { purchased?: boolean }> {
    const article = await this.articlesRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException('Статья не найдена');
    }

    // Проверяем доступность материала
    let purchased = false;
    if (!article.isPaid) {
      purchased = true; // Бесплатные материалы доступны всем
    } else if (userId) {
      // Проверяем, куплен ли платный материал
      const userMaterial = await this.userMaterialsRepository.findOne({
        where: { userId, articleId: id },
      });
      purchased = !!userMaterial;
    }

    article.views++;
    await this.articlesRepository.save(article);

    return { ...article, purchased };
  }

  async create(articleData: Partial<Article>): Promise<Article> {
    const article = this.articlesRepository.create(articleData);
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

    return visibleCourses.map((article) => ({
      id: article.id,
      title: article.title,
      author: article.author,
      price: Number(article.price || 0),
      purchased: purchasedArticleIds.includes(article.id),
      isPaid: article.isPaid,
      views: article.views,
      isVerified: article.isVerified,
    }));
  }

  async getArticles(userId?: string): Promise<any[]> {
    const articles = await this.articlesRepository.find({
      where: { type: 'article' },
      order: { createdAt: 'DESC' },
    });

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
    }));
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
    
    // Если материал платный, проверяем баланс и списываем средства
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
    // Если материал бесплатный (price <= 0), просто открываем доступ без списания средств

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
    articleData: { title: string; content: string; telegraphData?: any },
  ): Promise<Article> {
    const slot = await this.articleSlotsRepository.findOne({ where: { id: slotId, userId } });
    if (!slot) {
      throw new NotFoundException('Слот не найден');
    }

    if (slot.isUsed) {
      throw new BadRequestException('Слот уже использован');
    }

    const user = await this.usersService.findOne(userId);

    // Создаем статью
    const article = this.articlesRepository.create({
      title: articleData.title,
      content: articleData.content,
      telegraphData: articleData.telegraphData,
      author: user.username || user.telegramId?.toString() || 'Пользователь',
      authorId: userId,
      type: 'article',
      isPaid: false,
      price: 0,
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
    courseData: { title: string; description?: string; content: string; price: number },
  ): Promise<Article> {
    const user = await this.usersService.findOne(userId);

    // Создаем курс - по умолчанию не верифицирован
    const course = this.articlesRepository.create({
      title: courseData.title,
      content: courseData.content || courseData.description || '',
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
}

