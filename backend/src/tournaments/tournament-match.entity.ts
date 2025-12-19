import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tournament } from './tournament.entity';
import { User } from '../users/user.entity';
import { Game } from '../games/game.entity';

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  BYE = 'bye',
}

@Entity('tournament_matches')
export class TournamentMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tournament)
  tournament: Tournament;

  @Column()
  @Index()
  tournamentId: string;

  @ManyToOne(() => User, { nullable: true })
  player1: User;

  @Column({ nullable: true })
  player1Id: string;

  @ManyToOne(() => User, { nullable: true })
  player2: User;

  @Column({ nullable: true })
  player2Id: string;

  @ManyToOne(() => Game, { nullable: true })
  game: Game;

  @Column({ nullable: true })
  gameId: string;

  @Column({ type: 'int' })
  round: number;

  @Column({ type: 'int' })
  matchNumber: number;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.SCHEDULED,
  })
  status: MatchStatus;

  @Column({ nullable: true })
  winnerId: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

