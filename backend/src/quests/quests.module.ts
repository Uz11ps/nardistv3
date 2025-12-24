import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestsService } from './quests.service';
import { QuestsController } from './quests.controller';
import { Quest } from './quest.entity';
import { QuestProgress } from './quest-progress.entity';
import { ProgressModule } from '../progress/progress.module';
import { UsersModule } from '../users/users.module';
import { SkinsModule } from '../skins/skins.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { TournamentTicketsService } from '../tournaments/tournament-tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quest, QuestProgress]),
    ProgressModule,
    UsersModule,
    forwardRef(() => SkinsModule),
    forwardRef(() => TournamentsModule),
  ],
  controllers: [QuestsController],
  providers: [QuestsService],
  exports: [QuestsService],
})
export class QuestsModule {}

