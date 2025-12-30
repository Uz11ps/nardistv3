import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Material } from './material.entity';

@Entity('player_materials')
export class PlayerMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'playerId' })
  player: User;

  @Column()
  playerId: string;

  @ManyToOne(() => Material, { nullable: false })
  @JoinColumn({ name: 'materialId' })
  material: Material;

  @Column()
  materialId: string;

  @Column({ type: 'int', default: 0 })
  quantity: number; // Количество материала
}

