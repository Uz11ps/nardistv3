import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('article_slots')
export class ArticleSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'bigint', default: '0' })
  purchasePrice: string; // Цена покупки слота

  @Column({ default: false })
  isUsed: boolean; // Использован ли слот (создана ли статья)

  @Column({ nullable: true })
  articleId: string; // ID статьи, созданной в этом слоте

  @CreateDateColumn()
  purchasedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

