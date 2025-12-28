import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    imageUrl?: string,
  ): Promise<Notification> {
    const notification = this.notificationsRepository.create({
      userId,
      title,
      message,
      type,
      read: false,
      imageUrl: imageUrl || null,
    });
    return this.notificationsRepository.save(notification);
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100, // Ограничиваем последними 100 уведомлениями
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationsRepository.count({
      where: { userId, read: false },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Уведомление не найдено');
    }

    notification.read = true;
    return this.notificationsRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { userId, read: false },
      { read: true },
    );
  }

  async createNotificationForAllUsers(
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    userIds: string[],
    imageUrl?: string,
  ): Promise<Notification[]> {
    const notifications = userIds.map((userId) =>
      this.notificationsRepository.create({
        userId,
        title,
        message,
        type,
        read: false,
        imageUrl: imageUrl || null,
      }),
    );

    return this.notificationsRepository.save(notifications);
  }
}
