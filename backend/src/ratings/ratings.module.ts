import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { Rating } from './rating.entity';
import { SystemSettings } from '../admin/system-settings.entity';
import { Game } from '../games/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, SystemSettings, Game])],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}

