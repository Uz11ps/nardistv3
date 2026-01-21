import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ClanMember } from './clan-member.entity';

export enum District {
  DISTRICT_1 = 'district_1',
  DISTRICT_2 = 'district_2',
  DISTRICT_3 = 'district_3',
  DISTRICT_4 = 'district_4',
  DISTRICT_5 = 'district_5',
  DISTRICT_6 = 'district_6',
  DISTRICT_7 = 'district_7',
}

@Entity('clans')
export class Clan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'int', default: 0 })
  memberCount: number;

  @Column({ type: 'int', default: 5 })
  maxMembers: number;

  @Column({ type: 'bigint', default: 0 })
  treasury: string;

  @Column({ type: 'bigint', default: 0 })
  weeklyIncome: string;

  @Column({ type: 'int', default: 1 })
  clanLevel: number;

  @Column({ type: 'int', default: 1 })
  districtStrength: number;

  @Column({ type: 'int', default: 1 })
  economy: number;

  @Column({ type: 'int', default: 1 })
  fortLevel: number;

  @Column({ type: 'jsonb', nullable: true })
  ownedDistricts: District[];

  @Column({ type: 'timestamp', nullable: true })
  lastTerritoryCaptureAt: Date; // Последний захват территории (ограничение: раз в 3 дня)

  @Column()
  leaderId: string;

  @OneToMany(() => ClanMember, (member) => member.clan)
  members: ClanMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

