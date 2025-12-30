import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { DistrictName } from './district.entity';

export enum LicenseType {
  ONE_TIME = 'one_time', // Разовая
  RENEWABLE = 'renewable', // Продлеваемая
  EVENT = 'event', // Событийная
}

export enum LicenseCurrency {
  NAR = 'NAR',
  USDT = 'USDT',
}

@Entity('licenses')
export class License {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code: string; // Уникальный код лицензии (например: 'entrepreneur')

  @Column({ type: 'varchar', length: 200 })
  name: string; // Отображаемое название

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: LicenseType })
  type: LicenseType;

  @Column({ type: 'enum', enum: DistrictName, nullable: true })
  purchaseDistrict: DistrictName; // В каком районе покупается

  @Column({ type: 'int', default: 0 })
  minLevel: number; // Минимальный уровень игрока

  @Column({ type: 'varchar', length: 100, nullable: true })
  requiredLicense: string; // Требуемая лицензия (если нужна)

  @Column({ type: 'boolean', default: false })
  requiresPremium: boolean; // Требуется ли премиум

  @Column({ type: 'boolean', default: false })
  requiresVerification: boolean; // Требуется ли верификация

  @Column({ type: 'enum', enum: LicenseCurrency })
  currency: LicenseCurrency;

  @Column({ type: 'bigint', default: 0 })
  priceNar: number; // Цена в NAR (если currency = NAR)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceUsdt: number; // Цена в USDT (если currency = USDT)

  @Column({ type: 'int', nullable: true })
  durationDays: number; // Длительность в днях (null для разовых)

  @Column({ type: 'text', nullable: true })
  unlocks: string; // JSON с описанием что открывает лицензия

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}

