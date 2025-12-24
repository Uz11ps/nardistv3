import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Казна города для выплаты наград за уровни
 */
@Entity('city_treasury')
export class CityTreasury {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', default: 0 })
  balance: bigint; // Текущий баланс казны в NAR

  @Column({ type: 'bigint', default: 0 })
  totalCollected: bigint; // Всего собрано в казну

  @Column({ type: 'bigint', default: 0 })
  totalPaid: bigint; // Всего выплачено наград

  @UpdateDateColumn()
  updatedAt: Date;
}

