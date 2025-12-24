import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Tournament } from './tournament.entity';

/**
 * Билеты на турниры
 * Пользователи могут получать билеты за квесты и использовать их для участия в турнирах
 */
@Entity('tournament_tickets')
@Index(['userId'])
@Index(['tournamentId'])
export class TournamentTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Tournament, { nullable: true })
  tournament: Tournament;

  @Column({ nullable: true })
  tournamentId: string; // null = универсальный билет (можно использовать в любом турнире)

  /**
   * Источник получения билета
   */
  @Column({ nullable: true })
  source: string; // 'quest', 'purchase', 'admin', etc.

  /**
   * ID квеста, за который получен билет (если source = 'quest')
   */
  @Column({ nullable: true })
  questId: string;

  /**
   * Использован ли билет
   */
  @Column({ default: false })
  used: boolean;

  /**
   * Дата использования билета
   */
  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date;

  /**
   * ID турнира, в котором использован билет
   */
  @Column({ nullable: true })
  usedInTournamentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

