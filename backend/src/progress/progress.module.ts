import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { Enhancement } from './enhancement.entity';
import { UserPurchase } from './user-purchase.entity';
import { CityTreasury } from './city-treasury.entity';
import { UserRewardDebt } from './user-reward-debt.entity';
import { ProgressionConfig } from './progression-config.entity';
import { UsersModule } from '../users/users.module';
import { XpCalculatorService } from './xp-calculator.service';
import { ProgressionBranchesService } from './progression-branches.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Enhancement, UserPurchase, CityTreasury, UserRewardDebt, ProgressionConfig]),
    forwardRef(() => UsersModule),
    NotificationsModule,
  ],
  controllers: [ProgressController],
  providers: [ProgressService, XpCalculatorService, ProgressionBranchesService],
  exports: [ProgressService, XpCalculatorService, ProgressionBranchesService],
})
export class ProgressModule {}

