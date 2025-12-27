import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { TrainingTask } from './training-task.entity';

@Entity('user_task_progress')
@Unique(['userId', 'taskId'])
export class UserTaskProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => TrainingTask)
  task: TrainingTask;

  @Column()
  @Index()
  taskId: string;

  @Column({ type: 'int', default: 0 })
  progress: number; // Текущий прогресс

  @Column({ default: false })
  completed: boolean; // Задание выполнено

  @Column({ default: false })
  claimed: boolean; // Награда получена

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

