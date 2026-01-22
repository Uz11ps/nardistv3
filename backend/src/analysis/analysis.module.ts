import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { Game } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { SubscriptionModule } from '../subscription/subscription.module';
import { GamesModule } from '../games/games.module';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GameMove]),
    forwardRef(() => SubscriptionModule),
    GamesModule,
    forwardRef(() => BotModule),
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, BackgammonEngine, LongBackgammonEngine],
  exports: [AnalysisService],
})
export class AnalysisModule {}

