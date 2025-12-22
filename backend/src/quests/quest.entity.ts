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
  rewardSkin: any;

  @Column({ nullable: true })
  channelUsername: string; // Username канала для подписки (например, @channelname)

  @Column({ default: false })
  isPremium: boolean; // Только для премиум пользователей

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

