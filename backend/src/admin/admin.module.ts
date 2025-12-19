import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { AcademyModule } from '../academy/academy.module';
import { SkinsModule } from '../skins/skins.module';
import { GamesModule } from '../games/games.module';
import { User } from '../users/user.entity';
import { Game } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { Article } from '../academy/article.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Game, GameMove, Tournament, Article]),
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
    UsersModule,
    TournamentsModule,
    AcademyModule,
    SkinsModule,
    GamesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

