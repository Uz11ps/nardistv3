import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

export enum District {
  DISTRICT_1 = 'district_1',
  DISTRICT_2 = 'district_2',
  DISTRICT_3 = 'district_3',
  DISTRICT_4 = 'district_4',
  DISTRICT_5 = 'district_5',
  DISTRICT_6 = 'district_6',
  DISTRICT_7 = 'district_7',
}

export enum BuildingType {
  CLUB = 'club',
  WORKSHOP = 'workshop',
  FACTORY = 'factory',
  SCHOOL = 'school',
  MARKET = 'market',
  ACADEMY = 'academy',
  TEMPLE = 'temple',
}

@Entity('buildings')
export class Building {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: District,
  })
  district: District;

  @Column({
    type: 'enum',
    enum: BuildingType,
  })
  type: BuildingType;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'bigint', default: 0 })
  incomePerHour: string;

  @Column({ type: 'bigint', default: 0 })
  accumulatedIncome: string;

  @Column({ type: 'timestamp', nullable: true })
  lastCollectedAt: Date;

  // Захват кланом
  @Column({ nullable: true })
  capturedByClanId: string; // ID клана, который захватил это предприятие

  @Column({ type: 'timestamp', nullable: true })
  capturedAt: Date; // Дата захвата

  @Column({ type: 'bigint', default: 0 })
  purchasePrice: string; // Цена покупки предприятия

  @Column({ type: 'bigint', default: 0 })
  maxAccumulation: string; // Максимальное накопление дохода

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

