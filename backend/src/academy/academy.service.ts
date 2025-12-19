import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './article.entity';
import { UserMaterial } from './user-material.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AcademyService {
  constructor(
    @InjectRepository(Article)
    private articlesRepository: Repository<Article>,
    @InjectRepository(UserMaterial)
    private userMaterialsRepository: Repository<UserMaterial>,
    private usersService: UsersService,
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
    const articles = await this.articlesRepository.find({
      where: { type: 'course' },
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
    if (price <= 0) {
      throw new BadRequestException('Материал бесплатный, покупка не требуется');
    }

    if (Number(user.narCoin) < price) {
      throw new BadRequestException('Недостаточно NAR-coin');
    }

    // Списываем средства
    const userBalance = Number(user.narCoin);
    const newBalance = userBalance - price;
    await this.usersService.update(userId, { narCoin: newBalance });

    // Сохраняем покупку
    const userMaterial = this.userMaterialsRepository.create({
      userId,
      articleId: courseId,
      pricePaid: price,
    });
    await this.userMaterialsRepository.save(userMaterial);
  }
}

