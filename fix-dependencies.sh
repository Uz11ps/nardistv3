#!/bin/bash

echo "🔧 Исправление зависимостей..."

cd /var/www/nardiphp/backend/src

# Исправляем games.module.ts
cat > games/games.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { GamesGateway } from './games.gateway';
import { Game } from './game.entity';
import { GameMove } from './game-move.entity';
import { BackgammonEngine } from './game-engine/backgammon-engine';
import { LongBackgammonEngine } from './game-engine/long-backgammon-engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GameMove]),
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
  controllers: [GamesController],
  providers: [GamesService, GamesGateway, BackgammonEngine, LongBackgammonEngine],
  exports: [GamesService, BackgammonEngine, LongBackgammonEngine],
})
export class GamesModule {}
EOF

# Исправляем matchmaking.module.ts
cat > matchmaking/matchmaking.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingGateway } from './matchmaking.gateway';
import { GamesModule } from '../games/games.module';
import { RedisModule } from '../config/redis.module';
import { RatingsModule } from '../ratings/ratings.module';

@Module({
  imports: [
    GamesModule,
    RedisModule,
    RatingsModule,
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
EOF

echo "✅ Зависимости исправлены"
echo "Пересобираем backend..."
cd /var/www/nardiphp
docker-compose build --no-cache backend
docker-compose up -d backend

sleep 5
echo "Проверяем логи..."
docker-compose logs --tail=50 backend

