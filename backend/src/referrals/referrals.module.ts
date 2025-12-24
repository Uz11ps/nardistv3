import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { UsersModule } from '../users/users.module';
import { ProgressModule } from '../progress/progress.module';
import { ReferralEarning } from './referral-earning.entity';
import { Game } from '../games/game.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReferralEarning, Game]),
    UsersModule,
    ProgressModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}

