import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { Enhancement } from './enhancement.entity';
import { UserPurchase } from './user-purchase.entity';
import { CityTreasury } from './city-treasury.entity';
import { UserRewardDebt } from './user-reward-debt.entity';
import { UsersModule } from '../users/users.module';
import { XpCalculatorService } from './xp-calculator.service';
import { ProgressionBranchesService } from './progression-branches.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Enhancement, UserPurchase, CityTreasury, UserRewardDebt]),
    forwardRef(() => UsersModule),
  ],
  controllers: [ProgressController],
  providers: [ProgressService, XpCalculatorService, ProgressionBranchesService],
  exports: [ProgressService, XpCalculatorService, ProgressionBranchesService],
})
export class ProgressModule {}

