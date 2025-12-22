import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { District, BuildingType } from './building.entity';

@Entity('building_configs')
export class BuildingConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ type: 'bigint' })
  basePrice: string; // Базовая цена покупки

  @Column({ type: 'bigint' })
  baseIncomePerHour: string; // Базовый доход в час

  @Column({ type: 'bigint' })
  maxAccumulation: string; // Максимальное накопление

  @Column({ type: 'int', default: 1 })
  maxLevel: number; // Максимальный уровень улучшения

  @Column({ type: 'jsonb', nullable: true })
  upgradeCosts: any; // Стоимость улучшения по уровням { level: cost }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

