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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

