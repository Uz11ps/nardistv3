import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  telegramId: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ default: 'ru' })
  languageCode: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  nickname: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  referralCode: string;

  @Column({ nullable: true })
  referredBy: string;

  @Column({ default: 0 })
  level: number;

  @Column({ type: 'bigint', default: 0 })
  xp: bigint;

  @Column({ type: 'bigint', default: 1000 })
  narCoin: bigint;

  @Column({ default: 'economy' })
  enhancement: string;

  @Column({ default: false })
  isBanned: boolean;

  @Column({ nullable: true })
  banReason: string;

  @Column({ default: false })
  isAdmin: boolean;

  @Column({ default: false })
  isTrainer: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

