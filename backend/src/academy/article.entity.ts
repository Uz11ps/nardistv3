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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

