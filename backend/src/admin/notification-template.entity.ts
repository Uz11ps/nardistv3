import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NotificationTemplateType {
  INACTIVE_USER = 'inactive_user', // Уведомление о неактивности (месяц)
  BIRTHDAY = 'birthday', // Поздравление с днем рождения
  TOURNAMENT_START = 'tournament_start', // Начало турнира
  QUEST_COMPLETED = 'quest_completed', // Задание выполнено
  CLAN_INVITE = 'clan_invite', // Приглашение в клан
  CUSTOM = 'custom', // Произвольное уведомление
}

@Entity('notification_templates')
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: NotificationTemplateType,
    unique: true,
  })
  type: NotificationTemplateType;

  @Column({ type: 'text' })
  title: string; // Заголовок уведомления

  @Column({ type: 'text' })
  message: string; // Текст уведомления (поддерживает переменные: {username}, {level}, {days} и т.д.)

  @Column({ default: true })
  isActive: boolean; // Активен ли шаблон

  @Column({ type: 'int', nullable: true })
  daysThreshold: number; // Порог дней для автоматических уведомлений (например, 30 для неактивности)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

