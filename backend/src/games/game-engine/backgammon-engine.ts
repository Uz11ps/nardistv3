import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface BoardState {
  points: number[];
  bar: [number, number];
  borneOff: [number, number];
  currentPlayer: number;
  dice: number[];
  canDouble: boolean;
  cubeValue: number;
  cubeOwner: number;
}

@Injectable()
export class BackgammonEngine {
  private readonly BOARD_SIZE = 24;
  private readonly INITIAL_BOARD = [
    2, 0, 0, 0, 0, -5, 0, -3, 0, 0, 0, 5, -5, 0, 0, 0, 3, 0, 5, 0, 0, 0, 0, -2
  ];

  createInitialState(): BoardState {
    return {
      points: [...this.INITIAL_BOARD],
      bar: [0, 0],
      borneOff: [0, 0],
      currentPlayer: 0,
      dice: [],
      canDouble: true,
      cubeValue: 1,
      cubeOwner: -1,
    };
  }

  rollDice(seed?: string): number[] {
    const rng = seed ? this.createSeededRNG(seed) : Math.random;
    const die1 = Math.floor(rng() * 6) + 1;
    const die2 = Math.floor(rng() * 6) + 1;
    return die1 === die2 ? [die1, die1, die1, die1] : [die1, die2];
  }

  createSeededRNG(seed: string): () => number {
    let hash = crypto.createHash('sha256').update(seed).digest('hex');
    let index = 0;

    return () => {
      if (index >= hash.length - 8) {
        hash = crypto.createHash('sha256').update(hash).digest('hex');
        index = 0;
      }
      const value = parseInt(hash.substr(index, 8), 16) / 0xffffffff;
      index += 8;
      return value;
    };
  }

  validateMove(state: BoardState, from: number, to: number, die: number): boolean {
    if (state.currentPlayer === 0) {
      return this.validateMovePlayer1(state, from, to, die);
    } else {
      return this.validateMovePlayer2(state, from, to, die);
    }
  }

  private validateMovePlayer1(state: BoardState, from: number, to: number, die: number): boolean {
    // Player 1 (White) moves from index 0 towards index 23 (Point 24 to 1)
    
    // If checkers on bar, must enter from bar first
    if (state.bar[0] > 0) {
      if (from !== -1) return false;
      const enterPoint = die - 1; // Die 1 -> Index 0, Die 6 -> Index 5
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE) return false;
      // Cannot enter on opponent's point (2 or more opponent checkers)
      if (state.points[enterPoint] < -1) return false;
      return to === enterPoint || to === -1;
    }

    // Regular move from board
    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] <= 0) return false; // No white checker at from point

    const toPoint = from + die;
    
    // Bearing off
    if (toPoint >= this.BOARD_SIZE) {
      if (!this.canBearOff(state, 0)) return false;
      
      const distanceToFinish = this.BOARD_SIZE - from; // 1 to 6
      if (die === distanceToFinish) {
        return to === -1 || to >= this.BOARD_SIZE;
      }
      if (die > distanceToFinish) {
        // Can only bear off from a closer point if no checkers are further away
        for (let i = 0; i < from; i++) {
          if (state.points[i] > 0) return false;
        }
        return to === -1 || to >= this.BOARD_SIZE;
      }
      return false; // die < distance, must move within home
    }

    // Regular move on board
    if (to !== toPoint && to !== -1) return false;
    
    // Cannot move to opponent's point (2 or more opponent checkers)
    if (state.points[toPoint] < -1) return false;
    
    return true;
  }

  private validateMovePlayer2(state: BoardState, from: number, to: number, die: number): boolean {
    // Player 2 (Black) moves from index 23 towards index 0 (Point 1 to 24)
    
    // If checkers on bar, must enter from bar first
    if (state.bar[1] > 0) {
      if (from !== -1) return false;
      const enterPoint = this.BOARD_SIZE - die; // Die 1 -> Index 23, Die 6 -> Index 18
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE) return false;
      // Cannot enter on opponent's point (2 or more opponent checkers)
      if (state.points[enterPoint] > 1) return false;
      return to === enterPoint || to === -1;
    }

    // Regular move from board
    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] >= 0) return false; // No black checker at from point

    const toPoint = from - die;
    
    // Bearing off
    if (toPoint < 0) {
      if (!this.canBearOff(state, 1)) return false;
      
      const distanceToFinish = from + 1; // 1 to 6
      if (die === distanceToFinish) {
        return to === -1 || to < 0;
      }
      if (die > distanceToFinish) {
        // Can only bear off from a closer point if no checkers are further away
        for (let i = this.BOARD_SIZE - 1; i > from; i--) {
          if (state.points[i] < 0) return false;
        }
        return to === -1 || to < 0;
      }
      return false;
    }

    // Regular move on board
    if (to !== toPoint && to !== -1) return false;
    
    // Cannot move to opponent's point (2 or more opponent checkers)
    if (state.points[toPoint] > 1) return false;
    
    return true;
  }

  canBearOff(state: BoardState, player: number): boolean {
    if (player === 0) {
      // White: all checkers must be in indices 18-23
      const outsideHome = state.points.slice(0, 18).some(p => p > 0);
      return !outsideHome && state.bar[0] === 0;
    } else {
      // Black: all checkers must be in indices 0-5
      const outsideHome = state.points.slice(6).some(p => p < 0);
      return !outsideHome && state.bar[1] === 0;
    }
  }

  applyMove(state: BoardState, from: number, to: number, die: number): BoardState {
    const newState = JSON.parse(JSON.stringify(state));

    if (newState.currentPlayer === 0) {
      this.applyMovePlayer1(newState, from, to, die);
    } else {
      this.applyMovePlayer2(newState, from, to, die);
    }

    return newState;
  }

  private applyMovePlayer1(state: BoardState, from: number, to: number, die: number): void {
    // Entering from bar
    if (state.bar[0] > 0 && from === -1) {
      state.bar[0]--;
      const enterPointIndex = die - 1;
      
      // Hit opponent's single checker
      if (state.points[enterPointIndex] === -1) {
        state.points[enterPointIndex] = 1;
        state.bar[1]++;
      } else {
        state.points[enterPointIndex]++;
      }
      return;
    }

    // Bearing off
    if (to < 0 || to >= this.BOARD_SIZE) {
      if (state.points[from] > 0 && this.canBearOff(state, 0)) {
        state.points[from]--;
        state.borneOff[0]++;
      }
      return;
    }

    // Regular move
    if (state.points[from] > 0) {
      state.points[from]--;
      
      // Hit opponent's single checker
      if (state.points[to] === -1) {
        state.points[to] = 1;
        state.bar[1]++;
      } else {
        state.points[to]++;
      }
    }
  }

  private applyMovePlayer2(state: BoardState, from: number, to: number, die: number): void {
    // Entering from bar
    if (state.bar[1] > 0 && from === -1) {
      state.bar[1]--;
      const enterPointIndex = this.BOARD_SIZE - die;
      
      // Hit opponent's single checker
      if (state.points[enterPointIndex] === 1) {
        state.points[enterPointIndex] = -1;
        state.bar[0]++;
      } else {
        state.points[enterPointIndex]--;
      }
      return;
    }

    // Bearing off
    if (to < 0 || to >= this.BOARD_SIZE) {
      if (state.points[from] < 0 && this.canBearOff(state, 1)) {
        state.points[from]++;
        state.borneOff[1]++;
      }
      return;
    }

    // Regular move
    if (state.points[from] < 0) {
      state.points[from]++;
      
      // Hit opponent's single checker
      if (state.points[to] === 1) {
        state.points[to] = -1;
        state.bar[0]++;
      } else {
        state.points[to]--;
      }
    }
  }

  isGameFinished(state: BoardState): boolean {
    return state.borneOff[0] === 15 || state.borneOff[1] === 15;
  }

  getWinner(state: BoardState): number | null {
    if (state.borneOff[0] === 15) return 0;
    if (state.borneOff[1] === 15) return 1;
    return null;
  }

  /**
   * Получить все возможные комбинации ходов для данной позиции и кубиков
   * Учитывает обязательность использования всех кубиков, если это возможно
   */
  getAllValidMoves(state: BoardState, dice: number[]): Array<Array<{ from: number; to: number; die: number }>> {
    if (dice.length === 0) {
      return [];
    }

    const moves: Array<Array<{ from: number; to: number; die: number }>> = [];

    const findMoves = (
      currentState: BoardState,
      remainingDice: number[],
      path: Array<{ from: number; to: number; die: number }>,
    ): void => {
      // Если нет оставшихся кубиков, это валидный набор ходов
      if (remainingDice.length === 0) {
        moves.push([...path]);
        return;
      }

      // Пробуем использовать каждый доступный кубик
      const triedDice = new Set<number>();
      
      for (let i = 0; i < remainingDice.length; i++) {
        const die = remainingDice[i];
        
        // Пропускаем дубликаты в рамках одной итерации (но используем каждый кубик отдельно)
        if (triedDice.has(die)) {
          continue;
        }
        triedDice.add(die);
        
        const possibleMoves = this.getPossibleMovesForDie(currentState, die);
        
        if (possibleMoves.length > 0) {
          // Удаляем этот кубик из оставшихся
          const newRemainingDice = remainingDice.filter((_, idx) => idx !== i);
          
          // Пробуем каждый возможный ход с этим кубиком
          for (const move of possibleMoves) {
            const newState = this.applyMove(currentState, move.from, move.to, die);
            findMoves(newState, newRemainingDice, [...path, { ...move, die }]);
          }
        }
      }
    };

    findMoves(state, dice, []);

    // Если есть ходы, которые используют все кубики - возвращаем только их
    // Иначе возвращаем все возможные (когда невозможно использовать все)
    const movesUsingAllDice = moves.filter((moveSeq) => moveSeq.length === dice.length);
    
    if (movesUsingAllDice.length > 0) {
      return movesUsingAllDice;
    }

    // Если невозможно использовать все кубики, возвращаем максимальные последовательности
    if (moves.length === 0) {
      return [];
    }
    
    const maxLength = Math.max(...moves.map((m) => m.length));
    return moves.filter((m) => m.length === maxLength);
  }


  private getPossibleMovesForDie(state: BoardState, die: number): any[] {
    const moves: any[] = [];

    if (state.currentPlayer === 0) {
      // Player 1 (White)
      if (state.bar[0] > 0) {
        // Must enter from bar
        const enterPointIndex = die - 1;
        if (this.validateMove(state, -1, enterPointIndex, die)) {
          moves.push({ from: -1, to: enterPointIndex });
        }
      } else {
        // Regular moves from board
        for (let from = 0; from < this.BOARD_SIZE; from++) {
          if (state.points[from] > 0) {
            const to = from + die;
            // Handle bearing off
            if (to >= this.BOARD_SIZE) {
              if (this.canBearOff(state, 0) && this.validateMove(state, from, -1, die)) {
                moves.push({ from, to: -1 });
              }
            } else if (this.validateMove(state, from, to, die)) {
              moves.push({ from, to });
            }
          }
        }
      }
    } else {
      // Player 2 (Black)
      if (state.bar[1] > 0) {
        // Must enter from bar
        const enterPointIndex = this.BOARD_SIZE - die;
        if (this.validateMove(state, -1, enterPointIndex, die)) {
          moves.push({ from: -1, to: enterPointIndex });
        }
      } else {
        // Regular moves from board
        for (let from = 0; from < this.BOARD_SIZE; from++) {
          if (state.points[from] < 0) {
            const to = from - die;
            // Handle bearing off
            if (to < 0) {
              if (this.canBearOff(state, 1) && this.validateMove(state, from, -1, die)) {
                moves.push({ from, to: -1 });
              }
            } else if (this.validateMove(state, from, to, die)) {
              moves.push({ from, to });
            }
          }
        }
      }
    }

    return moves;
  }
}

