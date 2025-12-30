import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { District, DistrictName } from './district.entity';

export enum BusinessClass {
  A = 'A',
  B = 'B',
  C = 'C',
}

export enum MaterialPackage {
  WOOD_LACQUER = 'wood_lacquer', // Дерево + Лак
  FABRIC = 'fabric', // Ткань
  WOOD_LACQUER_METAL = 'wood_lacquer_metal', // Дерево + Лак + Металл
  STONE_RESIN = 'stone_resin', // Камень + Смола
  WOOD_METAL = 'wood_metal', // Дерево + Металл
  SERVICE = 'service', // Сервис (без материалов)
  LEATHER_FABRIC_METAL = 'leather_fabric_metal', // Кожа + Ткань + Металл
  LACQUER_MECHANICS = 'lacquer_mechanics', // Лак + Механика
  METAL = 'metal', // Металл
  LEATHER = 'leather', // Кожа
  STONE = 'stone', // Камень
}

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => District, { nullable: false })
  @JoinColumn({ name: 'districtId' })
  district: District;

  @Column()
  districtId: string;

  @Column({ type: 'enum', enum: BusinessClass })
  businessClass: BusinessClass;

  @Column({ type: 'enum', enum: MaterialPackage })
  materialPackage: MaterialPackage;

  @Column({ type: 'int', default: 1 })
  minLevel: number; // Минимальный уровень игрока для покупки

  @Column({ type: 'varchar', length: 50, nullable: true })
  requiredLicense: string; // Требуемая лицензия (если есть)

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  order: number; // Порядок отображения в районе
}

