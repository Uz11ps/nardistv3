import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

export enum EnhancementType {
  ECONOMY = 'economy',
  ENERGY = 'energy',
  LIVES = 'lives',
  POWER = 'power',
}

@Entity('enhancements')
export class Enhancement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: EnhancementType,
  })
  type: EnhancementType;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

