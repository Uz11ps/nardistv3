import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Задолженность по наградам за уровни (если казны не хватило)
 */
@Entity('user_reward_debt')
export class UserRewardDebt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'bigint' })
  amount: bigint; // Невыплаченная сумма в NAR

  @Column({ type: 'int' })
  level: number; // Уровень, за который не выплачена награда

  @Column({ default: false })
  paid: boolean; // Выплачена ли задолженность

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null; // Дата выплаты

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

