import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { GamesModule } from '../games/games.module';

@Module({
  imports: [GamesModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}

