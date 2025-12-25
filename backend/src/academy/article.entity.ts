import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string; // HTML контент статьи (как в телеграфф)

  @Column({ type: 'jsonb', nullable: true })
  telegraphData: any; // Данные в формате телеграфф (nodes)

  @Column({ nullable: true })
  author: string;

  @Column({ nullable: true })
  authorId: string; // ID пользователя-автора (если статья создана пользователем)

  @Column({ default: 'article' })
  type: string; // 'article' | 'course'

  @Column({ default: false })
  isPaid: boolean;

  @Column({ type: 'bigint', nullable: true, default: 0 })
  price: number;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ default: 0 })
  views: number;

  @Column({ default: false })
  isVerified: boolean; // Верифицирован ли курс администратором/модератором

  @Column({ nullable: true })
  verifiedBy: string; // ID администратора/модератора, который верифицировал

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date; // Дата верификации

  @Column({ default: false })
  isApproved: boolean; // Одобрена ли статья администратором (для пользовательских статей)

  @Column({ nullable: true })
  approvedBy: string; // ID администратора, который одобрил статью

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date; // Дата одобрения

  // Награда за прохождение курса (старые поля для обратной совместимости)
  @Column({ type: 'bigint', nullable: true, default: 0 })
  rewardNarCoin: number; // Награда в NAR-coin

  @Column({ type: 'int', nullable: true, default: 0 })
  rewardXP: number; // Награда в XP

  // Награды (может быть несколько) - массив объектов {narCoin, xp, skinId, etc}
  @Column({ type: 'jsonb', nullable: true })
  rewards: any[]; // Массив наград за прохождение курса

  // Задание для курса (JSON описание задания, которое нужно выполнить)
  @Column({ type: 'jsonb', nullable: true })
  assignment: any; // Задание для прохождения курса

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

