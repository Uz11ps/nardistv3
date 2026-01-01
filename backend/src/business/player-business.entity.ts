import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Business } from './business.entity';

@Entity('player_businesses')
export class PlayerBusiness {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'playerId' })
  player: User;

  @Column()
  playerId: string;

  @ManyToOne(() => Business, { nullable: false })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: string;

  @Column({ type: 'int', default: 1 })
  level: number; // Уровень бизнеса (1-10)

  @Column({ type: 'bigint', default: 0 })
  narAccumulated: bigint; // Накопленные NAR (не собраны)

  @Column({ type: 'bigint', default: 0 })
  materialsAccumulated: bigint; // Накопленные материалы (не собраны)

  @Column({ type: 'timestamp', nullable: true })
  lastCollectedAt: Date; // Время последнего сбора

  @Column({ type: 'boolean', default: false })
  hasManager: boolean; // Есть ли управляющий (автосбор)

  @Column({ type: 'timestamp', nullable: true })
  managerExpiresAt: Date; // Когда истекает управляющий

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

