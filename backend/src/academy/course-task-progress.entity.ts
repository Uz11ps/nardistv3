import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { CourseTask } from './course-task.entity';
import { User } from '../users/user.entity';

@Entity('course_task_progress')
@Index(['userId', 'taskId'], { unique: true })
export class CourseTaskProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  @Index()
  taskId: string;

  @ManyToOne(() => CourseTask)
  task: CourseTask;

  @Column({ type: 'int', default: 0 })
  progress: number; // Текущий прогресс (например, количество выполненных матчей)

  @Column({ type: 'int', nullable: true })
  targetProgress: number; // Целевой прогресс (из requirements.count или 1 по умолчанию)

  @Column({ default: false })
  isCompleted: boolean; // Выполнено ли задание

  @Column({ default: false })
  isRewardClaimed: boolean; // Получена ли награда

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null; // Время завершения задания

  @Column({ type: 'timestamp', nullable: true })
  rewardClaimedAt: Date | null; // Время получения награды

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Дополнительные данные (например, ID игры, позиции и т.д.)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

