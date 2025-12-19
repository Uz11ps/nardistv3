import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { TrainingPosition } from './training-position.entity';

@Entity('user_training_progress')
@Unique(['userId', 'positionId'])
export class UserTrainingProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => TrainingPosition)
  position: TrainingPosition;

  @Column()
  @Index()
  positionId: string;

  @Column({ default: false })
  completed: boolean; // Решил правильно

  @Column({ default: 0 })
  attempts: number; // Количество попыток

  @Column({ type: 'jsonb', nullable: true })
  lastMove: any; // Последний попробованный ход

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}

