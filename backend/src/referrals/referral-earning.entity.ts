import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('referral_earnings')
export class ReferralEarning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  referrer: User;

  @Column()
  @Index()
  referrerId: string; // ID пользователя, который получил доход

  @ManyToOne(() => User)
  referredUser: User;

  @Column()
  @Index()
  referredUserId: string; // ID реферала, который сделал донат

  @Column({ type: 'bigint' })
  donationAmount: bigint; // Сумма доната реферала

  @Column({ type: 'bigint' })
  referralBonus: bigint; // Начисленный бонус (процент + базовый)

  @Column({ type: 'int', nullable: true })
  referralPercent: number; // Процент, который был использован

  @Column({ type: 'bigint', nullable: true })
  referralBaseBonus: bigint; // Базовый бонус, который был использован

  @Column({ type: 'text', nullable: true })
  description: string; // Описание (например, "Донат на подписку", "Покупка NAR-coin")

  @CreateDateColumn()
  createdAt: Date;
}

