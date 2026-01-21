import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Clan } from './clan.entity';

@Entity('player_captures')
@Index(['playerId', 'capturingClanId'])
@Index(['expiresAt'])
export class PlayerCapture {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  playerId: string; // ID игрока, на которого наложен захват

  @ManyToOne(() => User)
  player: User;

  @Column()
  @Index()
  capturingClanId: string; // ID клана, который захватил игрока

  @ManyToOne(() => Clan)
  capturingClan: Clan;

  @Column()
  districtCode: string; // Код района, за который идет захват

  @Column({ type: 'timestamp' })
  capturedAt: Date; // Время наложения захвата

  @Column({ type: 'timestamp' })
  expiresAt: Date; // Время окончания захвата (1 час с момента наложения)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

