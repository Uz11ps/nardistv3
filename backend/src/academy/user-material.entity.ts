import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Article } from './article.entity';

@Entity('user_materials')
@Unique(['userId', 'articleId']) // Один пользователь может купить материал только один раз
export class UserMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => Article)
  article: Article;

  @Column()
  @Index()
  articleId: string;

  @Column({ type: 'int' })
  pricePaid: number; // Цена, которую заплатил пользователь

  @CreateDateColumn()
  purchasedAt: Date;
}

