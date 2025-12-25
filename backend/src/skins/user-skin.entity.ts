import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Skin } from './skin.entity';

@Entity('user_skins')
@Unique(['userId', 'skinId'])
export class UserSkin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Skin)
  skin: Skin;

  @Column()
  skinId: string;

  @Column({ default: false })
  isSelected: boolean;

  @Column({ type: 'int', nullable: true })
  currentDurability: number; // УСТАРЕЛО: используйте durability_current
  
  @Column({ type: 'int', nullable: true })
  durability_current: number; // Текущая прочность предмета (null = полная прочность)
}

