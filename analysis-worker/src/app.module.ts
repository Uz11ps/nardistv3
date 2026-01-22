import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisWorkerController } from './analysis-worker.controller';
import { AnalysisWorkerService } from './analysis-worker.service';
import { GnubgService } from './gnubg.service';
import { MCTSLongBackgammonService } from './mcts-long-backgammon.service';
import { LongBackgammonEngine } from './long-backgammon-engine';
import { BackgammonEngine } from './backgammon-engine';
import { Game } from './entities/game.entity';
import { GameMove } from './entities/game-move.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'nardist',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    TypeOrmModule.forFeature([Game, GameMove]),
  ],
  controllers: [AnalysisWorkerController],
  providers: [
    AnalysisWorkerService,
    GnubgService,
    MCTSLongBackgammonService,
    LongBackgammonEngine,
    BackgammonEngine,
  ],
})
export class AppModule {}

