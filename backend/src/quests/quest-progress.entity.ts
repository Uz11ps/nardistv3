import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Quest } from './quest.entity';
import { User } from '../users/user.entity';

@Entity('quest_progress')
@Unique(['userId', 'questId'])
export class QuestProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Quest)
  quest: Quest;

  @Column()
  questId: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ default: false })
  completed: boolean;

  @Column({ default: false })
  claimed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

