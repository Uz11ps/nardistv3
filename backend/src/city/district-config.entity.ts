import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('district_configs')
export class DistrictConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string; // Код района (district_1, district_2, etc.)

  @Column()
  name: string; // Название района

  @Column({ type: 'text', nullable: true })
  description: string; // Описание района

  @Column({ nullable: true })
  icon: string; // Иконка района (URL)

  @Column({ nullable: true })
  image: string; // Изображение района (URL)

  @Column({ type: 'int', default: 0 })
  order: number; // Порядок отображения

  @Column({ default: true })
  isActive: boolean; // Активен ли район

  @Column({ type: 'int', nullable: true })
  requiredLevel: number; // Требуемый уровень для доступа

  @Column({ type: 'bigint', default: 0 })
  baseIncomePerDay: string; // Базовый доход в день (для кланов)

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Дополнительные метаданные

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

