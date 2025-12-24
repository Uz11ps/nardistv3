import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Clan } from '../clans/clan.entity';
import { District } from '../clans/clan.entity';

@Entity('district_captures')
@Index(['districtCode', 'capturedByClanId'])
export class DistrictCapture {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  districtCode: string; // Код района (district_1, district_2, etc.)

  @Column()
  @Index()
  capturedByClanId: string; // ID клана, который захватил район

  @ManyToOne(() => Clan)
  clan: Clan;

  @Column({ type: 'timestamp' })
  capturedAt: Date; // Время захвата

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null; // Время окончания захвата (если есть ограничение)

  @Column({ type: 'bigint', default: 0 })
  totalIncomeCollected: string; // Общий доход, собранный с района

  @Column({ type: 'timestamp', nullable: true })
  lastIncomeCollection: Date | null; // Время последнего сбора дохода

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

