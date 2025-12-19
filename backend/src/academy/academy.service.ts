import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './article.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AcademyService {
  constructor(
    @InjectRepository(Article)
    private articlesRepository: Repository<Article>,
    private usersService: UsersService,
  ) {}

  async findAll(): Promise<Article[]> {
    return this.articlesRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Article> {
    const article = await this.articlesRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException('Статья не найдена');
    }
    article.views++;
    await this.articlesRepository.save(article);
    return article;
  }

  async create(articleData: Partial<Article>): Promise<Article> {
    const article = this.articlesRepository.create(articleData);
    return this.articlesRepository.save(article);
  }

  async update(id: string, articleData: Partial<Article>): Promise<Article> {
    const article = await this.findOne(id);
    Object.assign(article, articleData);
    return this.articlesRepository.save(article);
  }

  async delete(id: string): Promise<void> {
    await this.articlesRepository.delete(id);
  }

  async getCourses(): Promise<any[]> {
    const articles = await this.articlesRepository.find({
      where: { type: 'course' },
      order: { createdAt: 'DESC' },
    });
    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      author: article.author,
      price: Number(article.price || 0),
      purchased: false, // Проверяется через getUserMaterials
    }));
  }

  async getArticles(): Promise<any[]> {
    const articles = await this.articlesRepository.find({
      where: { type: 'article' },
      order: { createdAt: 'DESC' },
    });
    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      author: article.author,
      price: Number(article.price || 0),
      purchased: false,
    }));
  }

  async getUserMaterials(userId: string): Promise<any[]> {
    const user = await this.usersService.findOne(userId);
    // Здесь должна быть логика получения купленных материалов
    // Пока возвращаем пустой массив
    return [];
  }

  async purchaseCourse(userId: string, courseId: string): Promise<void> {
    const course = await this.findOne(courseId);
    const user = await this.usersService.findOne(userId);

    const price = Number(course.price || 0);
    if (Number(user.narCoin) < price) {
      throw new Error('Недостаточно NAR-coin');
    }

    // Списываем средства
    user.narCoin = BigInt(user.narCoin || 0) - BigInt(price);
    await this.usersService['usersRepository'].save(user);

    // Здесь должна быть логика сохранения покупки (таблица user_materials)
  }
}

