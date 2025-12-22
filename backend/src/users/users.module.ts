import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';
import { ProgressModule } from '../progress/progress.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BirthdayService } from './birthday.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), 
    forwardRef(() => ProgressModule),
    ScheduleModule.forRoot(),
    NotificationsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, BirthdayService],
  exports: [UsersService, BirthdayService],
})
export class UsersModule {}

