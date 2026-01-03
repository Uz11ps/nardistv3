import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { GameMove } from './game-move.entity';

export enum GameMode {
  SHORT = 'short',
  LONG = 'long',
}

export enum GameStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  ABANDONED = 'abandoned',
}

export enum GameType {
  VS_PLAYER = 'vs_player',
  VS_BOT = 'vs_bot',
  TOURNAMENT = 'tournament',
  SANDBOX = 'sandbox',
}

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: GameMode,
    default: GameMode.SHORT,
  })
  mode: GameMode;

  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.WAITING,
  })
  @Index()
  status: GameStatus;

  @Column({
    type: 'enum',
    enum: GameType,
    default: GameType.VS_PLAYER,
  })
  type: GameType;

  @ManyToOne(() => User, { nullable: true })
  player1: User;

  @Column({ nullable: true })
  player1Id: string;

  @ManyToOne(() => User, { nullable: true })
  player2: User;

  @Column({ nullable: true })
  player2Id: string;

  @Column({ default: 0 })
  player1Score: number;

  @Column({ default: 0 })
  player2Score: number;

  @Column({ type: 'jsonb', nullable: true })
  gameState: any;

  @Column({ type: 'text', nullable: true })
  rngSeed: string;

  @Column({ type: 'text', nullable: true })
  rngHash: string;

  @Column({ type: 'jsonb', nullable: true })
  p1Rolls: number[][]; // Предварительно сгенерированная последовательность бросков игрока 1

  @Column({ type: 'jsonb', nullable: true })
  p2Rolls: number[][]; // Предварительно сгенерированная последовательность бросков игрока 2

  @Column({ default: 1 })
  p1Offset: number; // Смещение, выбранное игроком 1

  @Column({ default: 1 })
  p2Offset: number; // Смещение, выбранное игроком 2

  @Column({ type: 'timestamp', nullable: true })
  p1OffsetChosenAt: Date; // Время выбора смещения игроком 1

  @Column({ type: 'timestamp', nullable: true })
  p2OffsetChosenAt: Date; // Время выбора смещения игроком 2

  @Column({ type: 'text', nullable: true })
  verificationSalt: string; // Соль для хеширования (раскрывается в конце игры)

  @Column({ nullable: true })
  currentPlayer: number;

  @Column({ type: 'bigint', default: 0 })
  moveTimeLimit: number;

  @Column({ type: 'bigint', default: 60000 })
  player1TimeRemaining: number; // Общее время игрока 1 в миллисекундах (60 секунд)

  @Column({ type: 'bigint', default: 60000 })
  player2TimeRemaining: number; // Общее время игрока 2 в миллисекундах (60 секунд)

  @Column({ type: 'timestamp', nullable: true })
  lastMoveAt: Date;

  @Column({ nullable: true })
  winnerId: string;

  @Column({ type: 'jsonb', nullable: true })
  skinData: any; // { player1: { board, dice, checkers }, player2: { board, dice, checkers } }

  @Column({ type: 'bigint', default: 0 })
  stake: number; // Ставка в NAR-coin (0 = игра без ставок)

  @Column({ type: 'integer', nullable: true })
  player1XP: number; // Начисленный XP для игрока 1

  @Column({ type: 'integer', nullable: true })
  player2XP: number; // Начисленный XP для игрока 2

  @OneToMany(() => GameMove, (move) => move.game)
  moves: GameMove[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

