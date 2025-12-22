import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AchievementType {
  WINS = 'wins',
  STREAK = 'streak',
  LEVEL = 'level',
  GAMES_PLAYED = 'games_played',
  TOURNAMENT = 'tournament',
  CLAN = 'clan',
}

@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string;

  @Column({
    type: 'enum',
    enum: AchievementType,
  })
  type: AchievementType;

  @Column({ type: 'int' })
  targetValue: number; // Целевое значение для достижения

  @Column({ type: 'jsonb', nullable: true })
  reward: any; // Награда { type: 'narCoin' | 'xp' | 'skin', amount: number }

  @Column({ default: false })
  isHidden: boolean; // Скрытое достижение

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

