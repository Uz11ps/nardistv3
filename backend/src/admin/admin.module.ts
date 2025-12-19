import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { AcademyModule } from '../academy/academy.module';
import { SkinsModule } from '../skins/skins.module';

@Module({
  imports: [UsersModule, TournamentsModule, AcademyModule, SkinsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

