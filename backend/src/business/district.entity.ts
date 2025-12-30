import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Business } from './business.entity';

export enum DistrictName {
  COURTYARDS = 'courtyards', // Дворы
  MASTERS_QUARTER = 'masters_quarter', // Квартал мастеров
  TRADE_GALLERY = 'trade_gallery', // Торговая галерея
  ACADEMY = 'academy', // Академия Нардиста
  CLUB_PROSPECT = 'club_prospect', // Клубный проспект
  CATHEDRAL_SQUARE = 'cathedral_square', // Соборная площадь
  SUPPLY_PIER = 'supply_pier', // Пристань снабжения
}

@Entity('districts')
export class District {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: DistrictName, unique: true })
  name: DistrictName;

  @Column({ type: 'varchar', length: 100 })
  displayName: string; // Отображаемое название

  @Column({ type: 'int', default: 0 })
  order: number; // Порядок отображения

  @OneToMany(() => Business, (business) => business.district)
  businesses: Business[];
}

