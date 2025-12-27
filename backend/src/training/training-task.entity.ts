import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TaskType {
  PLAY_GAME = 'play_game', // Сыграть игру
  WIN_GAME = 'win_game', // Выиграть игру
  COLLECT_INCOME = 'collect_income', // Собрать доход
  USE_SKIN = 'use_skin', // Использовать скин
}

@Entity('training_tasks')
export class TrainingTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TaskType,
  })
  @Index()
  type: TaskType;

  @Column({ type: 'int' })
  targetValue: number; // Целевое значение (например, сыграть 3 игры)

  @Column({ type: 'bigint', default: '0' })
  rewardNarCoin: string; // Награда в NAR

  @Column({ type: 'int', default: 0 })
  rewardXP: number; // Награда в XP

  @Column({ default: 1 })
  order: number; // Порядок отображения

  @Column({ default: false })
  isPremium: boolean; // Только для премиум пользователей

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

