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
  content: string;

  @Column({ nullable: true })
  author: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

