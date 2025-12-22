import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_settings')
export class SystemSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string; // Ключ настройки (например, 'course_royalty_percent')

  @Column({ type: 'text' })
  value: string; // Значение настройки (всегда строка, парсим при использовании)

  @Column({ type: 'text', nullable: true })
  description: string; // Описание настройки

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

