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

  @Column({ type: 'bigint', default: 0 })
  narCoin: bigint;

  @Column({ default: 'economy' })
  enhancement: string;

  // Энергия
  @Column({ type: 'int', default: 100 })
  energy: number;

  @Column({ type: 'int', default: 100 })
  maxEnergy: number;

  @Column({ type: 'timestamp', nullable: true })
  lastEnergyRestore: Date;

  // Жизни
  @Column({ type: 'int', default: 5 })
  lives: number;

  @Column({ type: 'int', default: 5 })
  maxLives: number;

  @Column({ type: 'timestamp', nullable: true })
  lastLifeRestore: Date;

  @Column({ default: false })
  isBanned: boolean;

  @Column({ nullable: true })
  banReason: string;

  @Column({ default: false })
  isAdmin: boolean;

  @Column({ default: false })
  isTrainer: boolean;

  @Column({ default: false })
  isGuest: boolean; // Гостевой пользователь (вошел через браузер без Telegram)

  @Column({ default: false })
  onboardingCompleted: boolean; // Прошел ли онбординг

  @Column({ default: false })
  profileSetupCompleted: boolean; // Заполнил ли профиль (никнейм, страна, аватарка)

  @Column({ default: false })
  starterKitClaimed: boolean; // Забрал ли стартовый набор

  @Column({ type: 'date', nullable: true })
  birthday: Date; // День рождения пользователя

  @Column({ type: 'timestamp', nullable: true })
  lastBirthdayGift: Date; // Дата последнего подарка на день рождения

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date; // Дата последнего входа

  @Column({ type: 'timestamp', nullable: true })
  lastInactiveNotification: Date; // Дата последнего уведомления о неактивности

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

