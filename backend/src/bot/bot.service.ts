import { Injectable, Logger } from '@nestjs/common';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';
import { GameMode } from '../games/game.entity';
import { GptBotService } from './gpt-bot.service';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private backgammonEngine: BackgammonEngine,
    private longBackgammonEngine: LongBackgammonEngine,
    private gptBotService: GptBotService,
  ) {}

  async makeBotMove(gameState: any, mode: GameMode): Promise<Array<{ from: number; to: number; die: number }>> {
    const engine = mode === GameMode.SHORT ? this.backgammonEngine : this.longBackgammonEngine;
    const dice = gameState.dice || [];

    if (dice.length === 0) {
      return [];
    }

    // Для длинных нард используем GPT если доступен, иначе простой выбор хода
    if (mode === GameMode.LONG) {
      const gptMoves = await this.gptBotService.getMoveFromGPT(gameState, dice, 'long');
      if (gptMoves.length > 0) {
        // Валидируем ходы от GPT
        const validMoves = this.validateGPTMoves(gameState, gptMoves, dice);
        if (validMoves.length > 0) {
          this.logger.log(`Using GPT moves: ${validMoves.length} moves`);
          return validMoves;
        }
      }
      // Fallback на простой бот если GPT не вернул валидные ходы
      return this.selectSimpleMove(gameState, dice);
    }

    const allValidMoves = (engine as any).getAllValidMoves ? (engine as any).getAllValidMoves(gameState, dice) : [];
    
    if (allValidMoves.length === 0) {
      return [];
    }

    const bestMove = this.selectBestMove(gameState, allValidMoves, mode);
    return bestMove;
  }

  private validateGPTMoves(
    gameState: any,
    moves: Array<{ from: number; to: number; die: number }>,
    dice: number[],
  ): Array<{ from: number; to: number; die: number }> {
    const validMoves: Array<{ from: number; to: number; die: number }> = [];
    const diceCopy = [...dice];
    let currentState = JSON.parse(JSON.stringify(gameState));

    for (const move of moves) {
      // Проверяем что кубик еще доступен
      const dieIndex = diceCopy.indexOf(move.die);
      if (dieIndex === -1) {
        continue; // Кубик уже использован
      }

      // Валидируем ход
      if (this.longBackgammonEngine.validateMove(currentState, move.from, move.to, move.die)) {
        validMoves.push(move);
        diceCopy.splice(dieIndex, 1);
        currentState = this.longBackgammonEngine.applyMove(currentState, move.from, move.to, move.die);
      }
    }

    return validMoves;
  }

  private selectSimpleMove(gameState: any, dice: number[]): Array<{ from: number; to: number; die: number }> {
    const moves: Array<{ from: number; to: number; die: number }> = [];
    const diceCopy = [...dice];
    let currentState = JSON.parse(JSON.stringify(gameState));

    // Сначала обрабатываем фишки на баре
    const bar = gameState.bar || [0, 0];
    const barCount = Array.isArray(bar) ? bar[gameState.currentPlayer || 0] : (gameState.currentPlayer === 0 ? bar.white : bar.black) || 0;

    if (barCount > 0) {
      for (const die of diceCopy) {
        const enterPoint = gameState.currentPlayer === 0 ? 24 - die : die - 1;
        if (enterPoint >= 0 && enterPoint < 24) {
          const pointValue = currentState.points[enterPoint] || 0;
          const canEnter = gameState.currentPlayer === 0 ? pointValue >= 0 : pointValue <= 0;
          
          if (canEnter) {
            moves.push({ from: -1, to: enterPoint, die });
            const dieIndex = diceCopy.indexOf(die);
            if (dieIndex !== -1) {
              diceCopy.splice(dieIndex, 1);
              currentState = this.longBackgammonEngine.applyMove(currentState, -1, enterPoint, die);
            }
          }
        }
      }
    }

    // Затем обрабатываем обычные ходы
    for (const die of diceCopy) {
      let foundMove = false;
      
      // Ищем лучший ход (ближе к дому)
      const points = currentState.points || [];
      const player = currentState.currentPlayer || 0;
      
      // Для белых идем от точки 23 к 0, для черных от 0 к 23
      const start = player === 0 ? 23 : 0;
      const end = player === 0 ? -1 : 24;
      const step = player === 0 ? -1 : 1;
      
      for (let i = start; i !== end; i += step) {
        const pointValue = points[i] || 0;
        const hasChecker = player === 0 ? pointValue > 0 : pointValue < 0;
        
        if (hasChecker) {
          const to = player === 0 ? i - die : i + die;
          
          // Проверяем валидность хода
          if (this.longBackgammonEngine.validateMove(currentState, i, to, die)) {
            moves.push({ from: i, to, die });
            currentState = this.longBackgammonEngine.applyMove(currentState, i, to, die);
            foundMove = true;
            break;
          }
        }
      }
      
      if (!foundMove) {
        // Пробуем вынос если возможно
        if (this.longBackgammonEngine.canBearOff(currentState, player)) {
          for (let i = start; i !== end; i += step) {
            const pointValue = points[i] || 0;
            const hasChecker = player === 0 ? pointValue > 0 : pointValue < 0;
            
            if (hasChecker) {
              const to = player === 0 ? -1 : 24;
              if (this.longBackgammonEngine.validateMove(currentState, i, to, die)) {
                moves.push({ from: i, to, die });
                currentState = this.longBackgammonEngine.applyMove(currentState, i, to, die);
                foundMove = true;
                break;
              }
            }
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

