import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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

