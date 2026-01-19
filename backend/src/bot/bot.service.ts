import { Injectable, Logger } from '@nestjs/common';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';
import { GameMode } from '../games/game.entity';
import { GptBotService } from './gpt-bot.service';
import { ImprovedBotService } from './improved-bot.service';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private backgammonEngine: BackgammonEngine,
    private longBackgammonEngine: LongBackgammonEngine,
    private gptBotService: GptBotService,
    private improvedBotService: ImprovedBotService,
  ) {}

  async makeBotMove(gameState: any, mode: GameMode): Promise<Array<{ from: number; to: number; die: number }>> {
    const engine = mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    const dice = gameState.dice || [];

    if (dice.length === 0) {
      return [];
    }

    // ВАЖНО: Нормализуем bar из объекта { white, black } в массив [white, black]
    // для совместимости с движком, который ожидает массив
    const normalizedState = { ...gameState };
    if (normalizedState.bar && !Array.isArray(normalizedState.bar)) {
      normalizedState.bar = [
        normalizedState.bar.white || normalizedState.bar[0] || 0,
        normalizedState.bar.black || normalizedState.bar[1] || 0
      ];
    }

    // Логируем состояние бара для отладки
    const player = normalizedState.currentPlayer || 0;
    const barValue = Array.isArray(normalizedState.bar) 
      ? normalizedState.bar[player] 
      : (normalizedState.bar?.[player === 0 ? 'white' : 'black'] || 0);
    this.logger.log(`Bot move: player=${player}, bar=${barValue}, dice=[${dice.join(', ')}], mode=${mode}`);
    this.logger.log(`Bot normalizedState.bar: ${JSON.stringify(normalizedState.bar)}`);

    // Get all valid moves from engine
    // Используем состояние игры как seed для детерминированного перемешивания
    const stateSeed = JSON.stringify(normalizedState.points) + JSON.stringify(dice) + normalizedState.currentPlayer;
    const allValidMoves = (engine as any).getAllValidMoves 
      ? (engine as any).getAllValidMoves(normalizedState, dice, false, stateSeed) 
      : [];
    
    this.logger.log(`Bot getAllValidMoves returned ${allValidMoves.length} move sequences`);
    
    // Логируем найденные ходы с бара
    const barMoves = allValidMoves.filter(seq => seq.some(m => m.from === -1));
    if (barMoves.length > 0) {
      this.logger.log(`Bot found ${barMoves.length} move sequences with bar moves: ${JSON.stringify(barMoves.map(seq => seq.filter(m => m.from === -1)))}`);
    } else if (barValue > 0) {
      this.logger.warn(`Bot has ${barValue} checkers on bar but no bar moves found!`);
      this.logger.warn(`Bot normalizedState: ${JSON.stringify({ bar: normalizedState.bar, currentPlayer: normalizedState.currentPlayer, points: normalizedState.points?.slice(0, 6) })}`);
    }
    
    if (allValidMoves.length === 0) {
      return [];
    }

    // For long backgammon, use GPT to evaluate moves (если доступен)
    if (mode === GameMode.LONG) {
      try {
        const gptSelectedMove = await this.gptBotService.evaluateMoves(
          normalizedState,
          allValidMoves,
          dice,
          'long',
        );
        
        if (gptSelectedMove && gptSelectedMove.length > 0) {
          this.logger.log(`GPT selected move sequence with ${gptSelectedMove.length} moves`);
          return gptSelectedMove;
        }
      } catch (error) {
        this.logger.warn(`GPT evaluation failed: ${error.message}, using improved bot`);
      }
      
      // Fallback to improved bot with heuristics
      return this.improvedBotService.selectBestMove(normalizedState, allValidMoves, mode);
    }

    // For short backgammon, use improved bot with heuristics
    const bestMove = this.improvedBotService.selectBestMove(normalizedState, allValidMoves, mode);
    
    // Логируем выбранный ход
    const hasBarMove = bestMove.some(m => m.from === -1);
    if (hasBarMove) {
      this.logger.log(`Bot selected move with bar: ${JSON.stringify(bestMove.filter(m => m.from === -1))}`);
    } else if (barValue > 0) {
      this.logger.warn(`Bot has ${barValue} checkers on bar but selected move without bar: ${JSON.stringify(bestMove)}`);
    }
    
    return bestMove;
  }

  private selectBestMove(
    currentState: any,
    validMoves: any[],
    mode: GameMode,
  ): Array<{ from: number; to: number; die: number }> {
    let bestMove = validMoves[0];
    let bestScore = this.evaluateMove(currentState, validMoves[0], mode);

    for (const move of validMoves.slice(1)) {
      const score = this.evaluateMove(currentState, move, mode);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private evaluateMove(currentState: any, move: any, mode: GameMode): number {
    let score = 0;

    for (const step of move) {
      const from = step.from;
      const to = step.to;

      if (mode === GameMode.SHORT) {
        score += this.evaluateShortBackgammonMove(currentState, from, to);
      } else {
        score += this.evaluateLongBackgammonMove(currentState, from, to);
      }
    }

    return score;
  }

  private evaluateShortBackgammonMove(state: any, from: number, to: number): number {
    let score = 0;
    const player = state.currentPlayer;
    const isPlayer1 = player === 0;

    if (from === -1) {
      score += 10;
    }

    if (to >= 0 && to < 24) {
      const point = state.points[to];
      
      if (isPlayer1) {
        if (point === -1) {
          score += 20;
        } else if (point === 0) {
          score += 5;
        }
        
        if (to >= 18 && to < 24) {
          score += 3;
        }
      } else {
        if (point === 1) {
          score += 20;
        } else if (point === 0) {
          score += 5;
        }
        
        if (to >= 0 && to < 6) {
          score += 3;
        }
      }
    } else {
      score += 15;
    }

    if (from >= 0 && from < 24) {
      const fromPoint = state.points[from];
      if (isPlayer1 && fromPoint === 1) {
        score += 2;
      } else if (!isPlayer1 && fromPoint === -1) {
        score += 2;
      }
    }

    return score;
  }

  private evaluateLongBackgammonMove(state: any, from: number, to: number): number {
    let score = 0;
    const player = state.currentPlayer;
    const isPlayer1 = player === 0;

    if (from === -1) {
      score += 10;
    }

    if (to >= 0 && to < 24) {
      const point = state.points[to];
      
      if (isPlayer1) {
        if (point === 0) {
          score += 5;
        }
        
        if (to >= 18 && to < 24) {
          score += 3;
        }
      } else {
        if (point === 0) {
          score += 5;
        }
        
        if (to >= 0 && to < 6) {
          score += 3;
        }
      }
    } else {
      score += 15;
    }

    return score;
  }
}

