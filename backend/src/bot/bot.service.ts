import { Injectable } from '@nestjs/common';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';
import { GameMode } from '../games/game.entity';

@Injectable()
export class BotService {
  constructor(
    private backgammonEngine: BackgammonEngine,
    private longBackgammonEngine: LongBackgammonEngine,
  ) {}

  async makeBotMove(gameState: any, mode: GameMode): Promise<Array<{ from: number; to: number; die: number }>> {
    const engine = mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    const dice = gameState.dice || [];

    if (dice.length === 0) {
      return [];
    }

    // Для длинных нард используем простой выбор хода
    if (mode === GameMode.LONG) {
      return this.selectSimpleMove(gameState, dice);
    }

    const allValidMoves = (engine as any).getAllValidMoves ? (engine as any).getAllValidMoves(gameState, dice) : [];
    
    if (allValidMoves.length === 0) {
      return [];
    }

    const bestMove = this.selectBestMove(gameState, allValidMoves, mode);
    return bestMove;
  }

  private selectSimpleMove(gameState: any, dice: number[]): Array<{ from: number; to: number; die: number }> {
    const moves: Array<{ from: number; to: number; die: number }> = [];
    // Простая логика для длинных нард
    for (const die of dice) {
      // Находим первую доступную фишку
      for (let i = 0; i < 24; i++) {
        if (gameState.points[i] !== 0) {
          const to = gameState.currentPlayer === 0 ? i - die : i + die;
          if (to >= 0 && to < 24) {
            moves.push({ from: i, to, die });
            break;
          }
        }
      }
    }
    return moves;
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

