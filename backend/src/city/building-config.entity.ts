import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('building_configs')
export class BuildingConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string; // Тип строения (shop, factory, etc.)

  @Column()
  name: string; // Название строения

  @Column({ nullable: true })
  icon: string; // Иконка строения (URL)

  @Column({ nullable: true })
  image: string; // Изображение строения (URL)

  @Column({ type: 'bigint' })
  basePrice: string; // Базовая цена (для уровня 1)

  @Column({ type: 'bigint' })
  baseIncomePerHour: string; // Базовый доход в час (для уровня 1)

  @Column({ type: 'bigint', default: 0 })
  maxAccumulation: string; // Максимальное накопление дохода

  @Column({ type: 'int', default: 10 })
  maxLevel: number; // Максимальный уровень

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1.15 })
  upgradeMultiplier: number; // Множитель для расчета стоимости улучшения (basePrice * multiplier^level)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.07 })
  incomeMultiplier: number; // Множитель для расчета дохода (baseIncomePerHour * (1 + multiplier * (level-1)))

  @Column({ type: 'jsonb', nullable: true })
  upgradeCosts: any; // Стоимость улучшения по уровням (опционально, если не используется формула)

  @Column({ nullable: true })
  districtId: string; // ID района, к которому привязано строение

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

