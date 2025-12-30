import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { Tournament } from './tournament.entity';
import { TournamentMatch } from './tournament-match.entity';
import { TournamentTicket } from './tournament-ticket.entity';
import { TournamentTicketsService } from './tournament-tickets.service';
import { GamesModule } from '../games/games.module';
import { RatingsModule } from '../ratings/ratings.module';
import { UsersModule } from '../users/users.module';
import { QuestsModule } from '../quests/quests.module';
import { ProgressModule } from '../progress/progress.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Tournament, TournamentMatch, TournamentTicket]),
    forwardRef(() => GamesModule),
    forwardRef(() => RatingsModule),
    UsersModule,
    forwardRef(() => QuestsModule),
    forwardRef(() => ProgressModule),
  ],
  controllers: [TournamentsController],
  providers: [TournamentsService, TournamentTicketsService],
  exports: [TournamentsService, TournamentTicketsService],
})
export class TournamentsModule {}

