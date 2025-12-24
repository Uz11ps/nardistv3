import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Article } from './article.entity';

export enum TaskType {
  TRAIN_WITH_BOT = 'train_with_bot', // Тренировка с ботом
  ONLINE_MATCH = 'online_match', // Онлайн-партия 1х1
  VIEW_CITY = 'view_city', // Просмотр экрана "Город"
  PLAY_SHORT_MATCH = 'play_short_match', // Быстрая партия (короткие нарды)
  PLAY_LONG_MATCH = 'play_long_match', // Длинная партия
  WIN_MATCH = 'win_match', // Победа в матче
  COMPLETE_TRAINING_POSITION = 'complete_training_position', // Пройти тренировочную позицию
  JOIN_CLAN = 'join_clan', // Вступить в клан
  PURCHASE_BUILDING = 'purchase_building', // Купить строение
  UPGRADE_BUILDING = 'upgrade_building', // Улучшить строение
  CUSTOM = 'custom', // Кастомное задание
}

@Entity('course_tasks')
@Index(['courseId', 'order'])
export class CourseTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  courseId: string | null; // ID курса (Article с type='course'), null для онбординговых заданий

  @ManyToOne(() => Article)
  course: Article;

  @Column({
    type: 'enum',
    enum: TaskType,
  })
  type: TaskType; // Тип задания

  @Column()
  title: string; // Название задания

  @Column({ type: 'text', nullable: true })
  description: string; // Описание задания

  @Column({ type: 'int', default: 0 })
  order: number; // Порядок выполнения заданий в курсе

  @Column({ type: 'jsonb', nullable: true })
  requirements: any; // Дополнительные требования (например, количество матчей, тип матча и т.д.)
  // Примеры:
  // { count: 1, mode: 'short' } для онлайн-партий
  // { positionId: 'uuid' } для тренировочных позиций
  // { buildingType: 'shop' } для покупки строения

  @Column({ type: 'bigint', default: 0 })
  rewardNarCoin: number; // Награда в NAR-coin за выполнение

  @Column({ type: 'int', default: 0 })
  rewardXP: number; // Награда в XP за выполнение

  @Column({ default: true })
  isRequired: boolean; // Обязательное ли задание (для онбординга)

  @Column({ default: false })
  isOnboarding: boolean; // Является ли заданием онбординга

  @Column({ default: true })
  isActive: boolean; // Активно ли задание

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

