import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from './config/database.config';
import { RedisModule } from './config/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { BotModule } from './bot/bot.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { RatingsModule } from './ratings/ratings.module';
import { ReferralsModule } from './referrals/referrals.module';
import { ProgressModule } from './progress/progress.module';
import { CityModule } from './city/city.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { QuestsModule } from './quests/quests.module';
import { HistoryModule } from './history/history.module';
import { AcademyModule } from './academy/academy.module';
import { SkinsModule } from './skins/skins.module';
import { AdminModule } from './admin/admin.module';
import { ClansModule } from './clans/clans.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    WinstonModule.forRoot({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    RedisModule,
    AuthModule,
    UsersModule,
    GamesModule,
    BotModule,
    MatchmakingModule,
    TournamentsModule,
    RatingsModule,
    ReferralsModule,
    ProgressModule,
    CityModule,
    SubscriptionModule,
    QuestsModule,
    HistoryModule,
    AcademyModule,
    SkinsModule,
    AdminModule,
    ClansModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

