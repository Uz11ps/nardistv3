import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { DistrictName } from './district.entity';

@Entity('player_locations')
export class PlayerLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'playerId' })
  player: User;

  @Column({ unique: true })
  playerId: string;

  @Column({ type: 'enum', enum: DistrictName, default: DistrictName.COURTYARDS })
  currentDistrict: DistrictName;

  @Column({ type: 'enum', enum: DistrictName, nullable: true })
  targetDistrict: DistrictName; // Куда идет игрок (null если никуда не идет)

  @Column({ type: 'timestamp', nullable: true })
  arrivalTime: Date; // Когда игрок прибудет в targetDistrict

  @Column({ type: 'timestamp', nullable: true })
  startedMovingAt: Date; // Когда началось перемещение
}

