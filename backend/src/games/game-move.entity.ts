import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Game } from './game.entity';
import { User } from '../users/user.entity';

@Entity('game_moves')
export class GameMove {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Game, (game) => game.moves)
  game: Game;

  @Column()
  @Index()
  gameId: string;

  @ManyToOne(() => User)
  player: User;

  @Column()
  playerId: string;

  @Column({ type: 'int' })
  moveNumber: number;

  @Column({ type: 'jsonb' })
  dice: number[];

  @Column({ type: 'jsonb' })
  moves: any[];

  @Column({ type: 'jsonb' })
  gameStateBefore: any;

  @Column({ type: 'jsonb' })
  gameStateAfter: any;

  @Column({ type: 'bigint', nullable: true })
  moveTimeMs: number;

  @CreateDateColumn()
  createdAt: Date;
}

