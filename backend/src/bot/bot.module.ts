import { Module, forwardRef } from '@nestjs/common';
import { BotService } from './bot.service';
import { GptBotService } from './gpt-bot.service';
import { BotController } from './bot.controller';
import { GamesModule } from '../games/games.module';
import { ConfigModule } from '@nestjs/config';
import { ReferralsModule } from '../referrals/referrals.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    forwardRef(() => GamesModule),
    ConfigModule,
    ReferralsModule,
    UsersModule,
  ],
  controllers: [BotController],
  providers: [BotService, GptBotService],
  exports: [BotService],
})
export class BotModule {}

