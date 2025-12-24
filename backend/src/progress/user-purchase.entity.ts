import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum PurchaseType {
  ENERGY = 'energy',
  LIVES = 'lives',
}

/**
 * История покупок энергии и жизней для отслеживания прогрессивной цены
 */
@Entity('user_purchases')
@Index(['userId', 'type', 'purchaseDate'])
export class UserPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: PurchaseType,
  })
  type: PurchaseType;

  @Column({ type: 'int' })
  amount: number; // Количество купленного (50 энергии или 5 жизней)

  @Column({ type: 'bigint' })
  cost: number; // Стоимость в NAR-coin

  @Column({ type: 'date' })
  @Index()
  purchaseDate: Date; // Дата покупки (для подсчета покупок за день)

  @CreateDateColumn()
  createdAt: Date;
}

