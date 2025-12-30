import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { License } from './license.entity';

@Entity('player_licenses')
export class PlayerLicense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'playerId' })
  player: User;

  @Column()
  playerId: string;

  @ManyToOne(() => License, { nullable: false })
  @JoinColumn({ name: 'licenseId' })
  license: License;

  @Column()
  licenseId: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date; // null для разовых лицензий

  @CreateDateColumn()
  purchasedAt: Date;
}

