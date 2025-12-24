import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { UserWallet } from './user-wallet.entity';
import { Subscription } from '../subscription/subscription.entity';
import { SubscriptionPlan } from '../subscription/subscription.entity';

export enum PaymentStatus {
  PENDING = 'pending', // Ожидает оплаты
  PROCESSING = 'processing', // Обрабатывается
  COMPLETED = 'completed', // Завершен
  FAILED = 'failed', // Неудачный
  CANCELLED = 'cancelled', // Отменен
}

export enum PaymentMethod {
  TON = 'ton',
  USDT = 'usdt',
  TELEGRAM_STARS = 'telegram_stars', // Позже
}

export enum PaymentType {
  SUBSCRIPTION = 'subscription',
  NAR_COIN = 'nar_coin',
  SKIN = 'skin',
}

/**
 * Транзакция платежа
 */
@Entity('payment_transactions')
@Index(['userId'])
@Index(['walletId'])
@Index(['status'])
@Index(['txHash'], { unique: true, where: '"txHash" IS NOT NULL' })
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => UserWallet, { nullable: true })
  wallet: UserWallet;

  @Column({ nullable: true })
  walletId: string;

  /**
   * Тип платежа
   */
  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  type: PaymentType;

  /**
   * Метод оплаты
   */
  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  /**
   * Статус платежа
   */
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  /**
   * Сумма платежа в TON (или эквивалент для USDT)
   */
  @Column({ type: 'decimal', precision: 18, scale: 9 })
  amount: number;

  /**
   * Сумма в USDT (если метод USDT)
   */
  @Column({ type: 'decimal', precision: 18, scale: 9, nullable: true })
  usdtAmount: number;

  /**
   * План подписки (если type = SUBSCRIPTION)
   */
  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    nullable: true,
  })
  subscriptionPlan: SubscriptionPlan;

  /**
   * Ссылка на подписку (если создана)
   */
  @ManyToOne(() => Subscription, { nullable: true })
  subscription: Subscription;

  @Column({ nullable: true })
  subscriptionId: string;

  /**
   * Хеш транзакции в блокчейне
   */
  @Column({ nullable: true, unique: true })
  txHash: string;

  /**
   * LT (Logical Time) транзакции
   */
  @Column({ type: 'bigint', nullable: true })
  lt: bigint;

  /**
   * Адрес отправителя (если известен)
   */
  @Column({ nullable: true })
  fromAddress: string;

  /**
   * Адрес получателя (наш кошелек)
   */
  @Column()
  toAddress: string;

  /**
   * Комментарий к транзакции (для идентификации платежа)
   */
  @Column({ nullable: true })
  comment: string;

  /**
   * Дополнительные данные (JSON)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  /**
   * Время подтверждения транзакции
   */
  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  /**
   * Количество попыток проверки транзакции
   */
  @Column({ type: 'int', default: 0 })
  checkAttempts: number;

  /**
   * Последняя ошибка при проверке
   */
  @Column({ type: 'text', nullable: true })
  lastError: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

