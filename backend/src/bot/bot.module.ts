import { Module, forwardRef } from '@nestjs/common';
import { BotService } from './bot.service';
import { GptBotService } from './gpt-bot.service';
import { GamesModule } from '../games/games.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [forwardRef(() => GamesModule), ConfigModule],
  providers: [BotService, GptBotService],
  exports: [BotService],
})
export class BotModule {}

