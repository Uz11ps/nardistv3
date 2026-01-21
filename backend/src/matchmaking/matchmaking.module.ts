import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingGateway } from './matchmaking.gateway';
import { GamesModule } from '../games/games.module';
import { RedisModule } from '../config/redis.module';
import { RatingsModule } from '../ratings/ratings.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { UsersModule } from '../users/users.module';
import { ClansModule } from '../clans/clans.module';

@Module({
  imports: [
    forwardRef(() => GamesModule),
    RedisModule,
    RatingsModule,
    UsersModule,
    forwardRef(() => SubscriptionModule),
    forwardRef(() => ClansModule),
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
  ],
  providers: [MatchmakingService, MatchmakingGateway],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}

