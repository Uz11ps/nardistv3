import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { PaymentTransaction } from './payment-transaction.entity';

/**
 * Кошелек пользователя для оплаты через TON/USDT
 * Для каждого пользователя создается отдельный кошелек
 * Приватный ключ хранится в зашифрованном виде
 */
@Entity('user_wallets')
@Index(['userId'], { unique: true })
export class UserWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  @Index()
  userId: string;

  /**
   * Адрес кошелька TON (в формате EQ...)
   */
  @Column({ unique: true })
  address: string;

  /**
   * Приватный ключ в зашифрованном виде (base64)
   * Расшифровка происходит только в админ панели
   */
  @Column({ type: 'text' })
  encryptedPrivateKey: string;

  /**
   * IV (Initialization Vector) для расшифровки приватного ключа
   */
  @Column({ type: 'text' })
  iv: string;

  /**
   * Публичный ключ (для проверки подписей)
   */
  @Column({ type: 'text', nullable: true })
  publicKey: string;

  /**
   * Тип кошелька (v3R2, v4R2 и т.д.)
   */
  @Column({ default: 'v4R2' })
  walletType: string;

  /**
   * Активен ли кошелек
   */
  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => PaymentTransaction, (transaction) => transaction.wallet)
  transactions: PaymentTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

