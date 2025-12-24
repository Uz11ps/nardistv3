import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * История матчей между игроками для отслеживания анти-фарма
 * Хранит пары игроков и количество матчей за последние 24 часа
 */
@Entity('player_match_history')
@Unique(['player1Id', 'player2Id'])
export class PlayerMatchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  player1Id: string; // Меньший ID (для уникальности пары)

  @Column()
  @Index()
  player2Id: string; // Больший ID (для уникальности пары)

  @Column({ type: 'int', default: 1 })
  matchCount: number; // Количество матчей за последние 24 часа

  @Column({ type: 'timestamp' })
  firstMatchAt: Date; // Время первого матча в окне 24 часа

  @Column({ type: 'timestamp' })
  lastMatchAt: Date; // Время последнего матча

  @CreateDateColumn()
  createdAt: Date;
}

