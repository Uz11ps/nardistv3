import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum MaterialType {
  WOOD = 'wood', // Дерево
  METAL = 'metal', // Металл
  RESIN = 'resin', // Смола/композит
  LEATHER = 'leather', // Кожа
  FABRIC = 'fabric', // Ткань
  STONE = 'stone', // Кость/камень
  LACQUER = 'lacquer', // Лак/финиш
  MECHANICS = 'mechanics', // Механика
}

export enum MaterialSort {
  S1 = 1, // Сорт 1 (базовый)
  S2 = 2, // Сорт 2
  S3 = 3, // Сорт 3
  S4 = 4, // Сорт 4 (премиум)
}

@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MaterialType })
  type: MaterialType;

  @Column({ type: 'int' })
  sort: MaterialSort; // 1-4

  @Column({ type: 'varchar', length: 100 })
  name: string; // Например: "Сосна", "Дуб", "Титан"

  @Column({ type: 'text', nullable: true })
  description: string;
}

