import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum QuestType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  SPECIAL = 'special',
}

export enum QuestTarget {
  PLAY_MATCHES = 'play_matches',
  WIN_STREAK = 'win_streak',
  COLLECT_INCOME = 'collect_income',
  TOURNAMENT = 'tournament',
  SUBSCRIBE_CHANNEL = 'subscribe_channel',
}

export enum QuestCategory {
  REGULAR = 'regular', // Обычный квест
  ONBOARDING = 'onboarding', // Онбординг
}

@Entity('quests')
export class Quest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: QuestType,
  })
  @Index()
  type: QuestType;

  @Column({
    type: 'enum',
    enum: QuestTarget,
  })
  target: QuestTarget;

  @Column({ type: 'int' })
  targetValue: number;

  @Column({ type: 'bigint', default: '0' })
  rewardNarCoin: string;

  @Column({ type: 'int', default: 0 })
  rewardXP: number;

  @Column({ type: 'jsonb', nullable: true })
  rewardSkin: any; // ID скина или объект с данными скина

  @Column({ type: 'jsonb', nullable: true })
  rewardArticle: any; // ID статьи или объект с данными статьи

  @Column({ type: 'int', default: 0 })
  rewardTickets: number; // Количество билетов на турнир

  @Column({ nullable: true })
  channelUsername: string; // Username канала для подписки (например, @channelname)

  @Column({ default: false })
  isPremium: boolean; // Только для премиум пользователей

  @Column({
    type: 'enum',
    enum: QuestCategory,
    default: QuestCategory.REGULAR,
  })
  category: QuestCategory; // Категория квеста: обычный или онбординг

  @Column({ type: 'text', nullable: true })
  onboardingText: string; // Текст для онбординговых квестов

  @Column({ type: 'int', default: 0 })
  order: number; // Порядок для онбординговых квестов

  @Column({ default: false })
  isRequired: boolean; // Обязательный ли квест (для онбординга)

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

