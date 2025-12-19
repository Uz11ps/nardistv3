import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { Game } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Game, GameMove])],
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}

