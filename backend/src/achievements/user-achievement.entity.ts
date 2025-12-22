import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Achievement } from './achievement.entity';
import { User } from '../users/user.entity';

@Entity('user_achievements')
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => Achievement)
  achievement: Achievement;

  @Column()
  @Index()
  achievementId: string;

  @Column({ type: 'int', default: 0 })
  progress: number; // Текущий прогресс

  @Column({ type: 'int' })
  maxProgress: number; // Максимальное значение для достижения

  @Column({ default: false })
  unlocked: boolean; // Разблокировано ли достижение

  @Column({ type: 'timestamp', nullable: true })
  unlockedAt: Date; // Дата разблокировки

  @Column({ default: false })
  claimed: boolean; // Получена ли награда

  @CreateDateColumn()
  createdAt: Date;
}

