import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { GamesGateway } from './games.gateway';
import { Game } from './game.entity';
import { GameMove } from './game-move.entity';
import { PlayerMatchHistory } from './player-match-history.entity';
import { BackgammonEngine } from './game-engine/backgammon-engine';
import { LongBackgammonEngine } from './game-engine/long-backgammon-engine';
import { ProgressModule } from '../progress/progress.module';
import { RatingsModule } from '../ratings/ratings.module';
import { UsersModule } from '../users/users.module';
import { BotModule } from '../bot/bot.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { SkinsModule } from '../skins/skins.module';
import { QuestsModule } from '../quests/quests.module';
import { TrainingModule } from '../training/training.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GameMove, PlayerMatchHistory]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '7d',
        },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => ProgressModule),
    forwardRef(() => RatingsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => BotModule),
    forwardRef(() => MatchmakingModule),
    forwardRef(() => SkinsModule),
    forwardRef(() => QuestsModule),
    forwardRef(() => TrainingModule),
    forwardRef(() => TournamentsModule),
  ],
  controllers: [GamesController],
  providers: [GamesService, GamesGateway, BackgammonEngine, LongBackgammonEngine],
  exports: [GamesService, GamesGateway, BackgammonEngine, LongBackgammonEngine],
})
export class GamesModule {}

