import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Clan } from './clan.entity';
import { User } from '../users/user.entity';

export enum ClanRole {
  LEADER = 'leader',
  OFFICER = 'officer',
  MEMBER = 'member',
}

@Entity('clan_members')
@Unique(['userId', 'clanId'])
export class ClanMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clan)
  clan: Clan;

  @Column()
  @Index()
  clanId: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: ClanRole,
    default: ClanRole.MEMBER,
  })
  role: ClanRole;

  @Column({ type: 'bigint', default: 0 })
  contribution: string;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt: Date;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

