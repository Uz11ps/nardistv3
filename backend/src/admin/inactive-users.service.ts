import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { AdminService } from './admin.service';

@Injectable()
export class InactiveUsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
  ) {}

  // ОТКЛЮЧЕНО: Проверка неактивных пользователей удалена
  // @Cron(CronExpression.EVERY_DAY_AT_2AM)
  // async checkInactiveUsers() {
  //   // Функциональность удалена
  // }
}

