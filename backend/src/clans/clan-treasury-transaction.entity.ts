import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Clan } from './clan.entity';
import { User } from '../users/user.entity';

export enum TreasuryTransactionType {
  CONTRIBUTION = 'contribution',
  UPGRADE = 'upgrade',
  INCOME = 'income',
}

@Entity('clan_treasury_transactions')
export class ClanTreasuryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clan)
  clan: Clan;

  @Column()
  @Index()
  clanId: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: TreasuryTransactionType,
  })
  type: TreasuryTransactionType;

  @Column({ type: 'bigint' })
  amount: string; // Положительное или отрицательное

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
