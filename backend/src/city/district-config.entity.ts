import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('district_configs')
@Index(['code'], { unique: true })
export class DistrictConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string; // Уникальный код территории (например, 'district_1')

  @Column()
  name: string; // Название территории (например, 'Центральный')

  @Column({ type: 'text', nullable: true })
  description: string; // Описание территории

  @Column({ type: 'int', default: 1 })
  order: number; // Порядок отображения

  @Column({ default: true })
  isActive: boolean; // Активна ли территория

  @Column({ type: 'bigint', default: 0 })
  baseIncomePerDay: string; // Базовый доход в день (для кланов)

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Дополнительные данные (цвет, иконка и т.д.)

  @Column({ type: 'int', default: 1 })
  requiredLevel: number; // Минимальный уровень для появления района

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

