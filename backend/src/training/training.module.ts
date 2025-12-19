import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';
import { TrainingPosition } from './training-position.entity';
import { UserTrainingProgress } from './user-training-progress.entity';
import { SubscriptionModule } from '../subscription/subscription.module';
import { GamesModule } from '../games/games.module';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrainingPosition, UserTrainingProgress]),
    forwardRef(() => SubscriptionModule),
    GamesModule,
  ],
  controllers: [TrainingController],
  providers: [TrainingService, BackgammonEngine, LongBackgammonEngine],
  exports: [TrainingService],
})
export class TrainingModule {}

