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

@Entity('buildings')
export class Building {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  district: string; // Район (district_1, district_2, etc.)

  @Column()
  type: string; // Тип строения (shop, factory, etc.)

  @Column({ type: 'int', default: 1 })
  level: number; // Уровень строения

  @Column({ type: 'bigint', default: 0 })
  accumulatedIncome: string; // Накопленный доход (в NAR-coin)

  @Column({ type: 'bigint', default: 0 })
  incomePerHour: string; // Доход в час (рассчитывается: baseIncomePerHour * 1.2^level)

  @Column({ type: 'timestamp', nullable: true })
  lastIncomeCollection: Date; // Время последнего сбора дохода

  // Захват кланом
  @Column({ nullable: true })
  @Index()
  capturedByClanId: string | null; // ID клана, который захватил строение

  @Column({ type: 'timestamp', nullable: true })
  capturedAt: Date | null; // Время захвата

  @Column({ type: 'timestamp', nullable: true })
  captureExpiresAt: Date | null; // Время окончания захвата (3 часа)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

