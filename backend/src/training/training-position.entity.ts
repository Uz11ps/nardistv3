import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('training_positions')
export class TrainingPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb' })
  position: any; // Состояние доски

  @Column({ default: 'short' })
  mode: string; // 'short' | 'long'

  @Column({ type: 'text', nullable: true })
  solution: string; // Описание правильного решения

  @Column({ type: 'jsonb', nullable: true })
  bestMoves: any[]; // Лучшие ходы

  @Column({ default: 1 })
  difficulty: number; // 1-5

  @Column({ default: false })
  isPremium: boolean; // Только для премиум пользователей

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

