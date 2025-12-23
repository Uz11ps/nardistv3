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
  type: string; // Тип скина: 'board' (доска), 'dice' (кубики), 'checkers' (шашки)

  @Column()
  theme: string;

  @Column({ type: 'jsonb', nullable: true })
  boardConfig: any;

  @Column({ type: 'jsonb', nullable: true })
  diceConfig: any;

  @Column({ type: 'jsonb', nullable: true })
  checkersConfig: any; // Конфигурация шашек

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: false })
  isPremium: boolean;

  @Column({ type: 'int', default: 1 })
  weight: number; // Вес скина для лимита силы

  @Column({ nullable: true })
  imageUrl: string; // URL превью изображения скина (для инвентаря и общего отображения)
  
  @Column({ nullable: true })
  shopImageUrl: string; // URL отдельного изображения для магазина

  @Column({ nullable: true })
  boardTextureUrl: string; // URL файла текстуры доски (для типа 'board')

  @Column({ nullable: true })
  diceTextureUrl: string; // URL файла текстуры кубиков (для типа 'dice') - устаревшее, используйте diceTextureUrls

  @Column({ type: 'jsonb', nullable: true })
  diceTextureUrls: any; // JSON объект с URL для каждого кубика: { 1: 'url1', 2: 'url2', 3: 'url3', 4: 'url4', 5: 'url5', 6: 'url6' }

  @Column({ nullable: true })
  checkersTextureUrl: string; // URL файла текстуры шашек (для типа 'checkers') - устаревшее, используйте whiteCheckersTextureUrl и blackCheckersTextureUrl
  
  @Column({ nullable: true })
  whiteCheckersTextureUrl: string; // URL файла текстуры белых шашек (для типа 'checkers')
  
  @Column({ nullable: true })
  blackCheckersTextureUrl: string; // URL файла текстуры черных шашек (для типа 'checkers')

  @Column({ type: 'int', nullable: true })
  price: number; // Цена в NAR-coin (если null - бесплатный)

  @Column({ default: 'common' })
  rarity: string; // Редкость: common, rare, epic, legendary

  @Column({ type: 'int', default: 100 })
  maxDurability: number; // Максимальная прочность скина (количество игр)

  @Column({ type: 'int', default: 0 })
  xpBonusPercent: number; // Бонус к опыту в процентах (например, 10 = +10%)

  @Column({ type: 'int', default: 0 })
  moneyBonusPercent: number; // Бонус к деньгам в процентах (например, 10 = +10%)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

