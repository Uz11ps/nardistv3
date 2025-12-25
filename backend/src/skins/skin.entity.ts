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
  type: string; // Тип скина: 'board' (доска), 'dice' (кубики), 'checkers' (шашки) - УСТАРЕЛО, используйте slot
  
  @Column({ nullable: true })
  slot: string; // Слот экипировки: BOARD, DIE_1, DIE_2, CHECKERS, CUP, CLOCK, CASE

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

  @Column({ default: 'COMMON' })
  rarity: string; // Редкость: COMMON, RARE, EPIC, LEGENDARY, MYTHIC, OLYMPIC_UNIQUE

  @Column({ type: 'int', default: 1 })
  required_level: number; // Минимальный уровень игрока для экипировки

  @Column({ type: 'int', nullable: true })
  required_power_sp: number; // Минимальные очки ветки "Сила" для экипировки

  @Column({ default: false })
  is_premium_shop: boolean; // Флаг: предмет куплен за USDT (ранний доступ)

  @Column({ type: 'int', nullable: true })
  durability_max: number; // Максимальная прочность предмета (устанавливается по редкости и слоту)

  @Column({ default: 'PER_MATCH' })
  wear_mode: string; // Режим износа: PER_MATCH (за партию) или PER_ROLL (за бросок)

  @Column({ type: 'int', default: 1 })
  wear_amount: number; // Сколько списывать прочности за событие (обычно 1)

  @Column({ type: 'float', default: 2.0 })
  tournament_wear_mult: number; // Множитель износа в турнирах (например 2.0 = минус 2 за партию)

  @Column({ type: 'jsonb', nullable: true })
  bonuses: any[]; // Список бонусов предмета: [{ type: 'XP_MULT', value: 1.10 }, ...]

  @Column({ default: 'NAR' })
  repair_currency: string; // Валюта ремонта: NAR (обычные) или USDT (олимпийские)

  @Column({ type: 'int', nullable: true })
  repair_base_cost: number; // Базовая стоимость полного ремонта

  @Column({ type: 'jsonb', nullable: true })
  daily_perk: any; // Опционально: «способность» предмета (раз в день / раз в 4 часа)

  // Устаревшие поля (для обратной совместимости):
  @Column({ type: 'int', default: 100 })
  maxDurability: number; // УСТАРЕЛО: используйте durability_max

  @Column({ type: 'int', default: 0 })
  xpBonusPercent: number; // УСТАРЕЛО: используйте bonuses с типом XP_MULT

  @Column({ type: 'int', default: 0 })
  moneyBonusPercent: number; // УСТАРЕЛО: используйте bonuses с типом COMMISSION_REDUCTION

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

