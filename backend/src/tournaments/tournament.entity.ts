import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TournamentMatch } from './tournament-match.entity';
import { GameMode } from '../games/game.entity';

export enum TournamentFormat {
  BRACKET = 'bracket',
  ROUND_ROBIN = 'round_robin',
}

export enum TournamentStatus {
  UPCOMING = 'upcoming',
  REGISTRATION = 'registration',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

@Entity('tournaments')
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TournamentFormat,
    default: TournamentFormat.BRACKET,
  })
  format: TournamentFormat;

  @Column({
    type: 'enum',
    enum: GameMode,
    default: GameMode.SHORT,
  })
  mode: GameMode;

  @Column({
    type: 'enum',
    enum: TournamentStatus,
    default: TournamentStatus.UPCOMING,
  })
  @Index()
  status: TournamentStatus;

  @Column({ type: 'int' })
  maxParticipants: number;

  @Column({ type: 'int', default: 0 })
  currentParticipants: number;

  @Column({ type: 'timestamp' })
  registrationStart: Date;

  @Column({ type: 'timestamp' })
  registrationEnd: Date;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  prizes: any;

  @OneToMany(() => TournamentMatch, (match) => match.tournament)
  matches: TournamentMatch[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

