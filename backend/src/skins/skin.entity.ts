import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('skins')
export class Skin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  theme: string;

  @Column({ type: 'jsonb' })
  boardConfig: any;

  @Column({ type: 'jsonb' })
  diceConfig: any;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: false })
  isPremium: boolean;

  @Column({ type: 'int', default: 1 })
  weight: number; // Вес скина для лимита силы

  @Column({ nullable: true })
  imageUrl: string; // URL изображения скина

  @Column({ type: 'int', nullable: true })
  price: number; // Цена в NAR-coin (если null - бесплатный)

  @Column({ default: 'common' })
  rarity: string; // Редкость: common, rare, epic, legendary

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

