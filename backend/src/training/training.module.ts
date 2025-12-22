import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';
import { TrainingPosition } from './training-position.entity';
import { UserTrainingProgress } from './user-training-progress.entity';
import { TrainingTask } from './training-task.entity';
import { UserTaskProgress } from './user-task-progress.entity';
import { SubscriptionModule } from '../subscription/subscription.module';
import { GamesModule } from '../games/games.module';
import { UsersModule } from '../users/users.module';
import { ProgressModule } from '../progress/progress.module';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrainingPosition, UserTrainingProgress, TrainingTask, UserTaskProgress]),
    forwardRef(() => SubscriptionModule),
    forwardRef(() => GamesModule),
    UsersModule,
    ProgressModule,
  ],
  controllers: [TrainingController],
  providers: [TrainingService, BackgammonEngine, LongBackgammonEngine],
  exports: [TrainingService],
})
export class TrainingModule {}

