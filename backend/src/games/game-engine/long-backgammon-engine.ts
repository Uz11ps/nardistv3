import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface LongBoardState {
  points: number[];
  bar: [number, number];
  borneOff: [number, number];
  currentPlayer: number;
  dice: number[];
  // Track moves from head in current turn for Head Rule
  movesFromHead: number;
  // Track how many checkers moved from each point in current turn (for doubles rule)
  movesFromPoint: { [pointIndex: number]: number };
}

@Injectable()
export class LongBackgammonEngine {
  private readonly BOARD_SIZE = 24;
  // Coordinate system (matching frontend POINT_NUMBERS):
  // Index 0 = Point 24 (Top Right) - White Head
  // Index 11 = Point 13 (Top Left)
  // Index 12 = Point 12 (Bottom Left) - Black Head
  // Index 23 = Point 1 (Bottom Right)
  // White (positive): 15 checkers on Point 24 (index 0) - HEAD
  // Black (negative): 15 checkers on Point 12 (index 12) - HEAD
  private readonly INITIAL_BOARD = [
    15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ];
  
  // Head positions (starting points)
  private readonly WHITE_HEAD = 0; // Point 24 (Top Right)
  private readonly BLACK_HEAD = 12; // Point 12 (Bottom Left)
  
  // Home quadrants
  // White home: Points 1-6 (indices 23, 22, 21, 20, 19, 18)
  // Black home: Points 13-18 (indices 11, 10, 9, 8, 7, 6)
  private readonly WHITE_HOME_START = 18; // Point 1-6 (indices 18-23)
  private readonly BLACK_HOME_START = 6; // Point 13-18 (indices 6-11)

  createInitialState(): LongBoardState {
    return {
      points: [...this.INITIAL_BOARD],
      bar: [0, 0],
      borneOff: [0, 0],
      currentPlayer: 0,
      dice: [],
      movesFromHead: 0,
      movesFromPoint: {},
    };
  }

  rollDice(seed?: string): number[] {
    const rng = seed ? this.createSeededRNG(seed) : Math.random;
    const die1 = Math.floor(rng() * 6) + 1;
    const die2 = Math.floor(rng() * 6) + 1;
    return [die1, die2];
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

  /**
   * Calculate target point for a move
   * Both players move counter-clockwise around the board (visually), which corresponds to INCREASING indices in our array
   * White: starts at Index 0 (Point 24), moves: 0→1→...→23 (Point 24→23→...→1)
   * Black: starts at Index 12 (Point 12), moves: 12→13→...→23→0→...→11 (Point 12→11→...→1→24→...→13)
   * 
   * Movement is circular: index increases modulo 24
   */
  private calculateTargetPoint(player: number, from: number, die: number): number {
    // Both players move by INCREASING index (decreasing Point Number)
    let to = (from + die) % this.BOARD_SIZE;
    return to;
  }

  /**
   * Check if a point is in the player's home quadrant
   * White home: Points 1-6 (indices 23, 22, 21, 20, 19, 18)
   * Black home: Points 13-18 (indices 11, 10, 9, 8, 7, 6)
   */
  private isInHome(player: number, pointIndex: number): boolean {
    if (player === 0) {
      // White home: indices 18-23 (Points 1-6)
      return pointIndex >= this.WHITE_HOME_START && pointIndex < this.BOARD_SIZE;
    } else {
      // Black home: indices 6-11 (Points 13-18)
      return pointIndex >= this.BLACK_HOME_START && pointIndex < 12;
    }
  }

  /**
   * Check Head Rule: Only 1 checker can be moved from head per complete turn (using all dice)
   * This rule applies only to non-doubles moves
   */
  private checkHeadRule(state: LongBoardState, from: number, dice: number[]): boolean {
    const player = state.currentPlayer;
    const headIndex = player === 0 ? this.WHITE_HEAD : this.BLACK_HEAD;
    
    // If not moving from head, rule doesn't apply
    if (from !== headIndex) {
      return true;
    }
    
    const movedThisTurn = state.movesFromHead || 0;
    
    // For non-doubles: only 1 checker per turn from head
    return movedThisTurn === 0;
  }

  /**
   * Check Block Rule: Cannot create a block of 6 consecutive points if no opponent checker is ahead
   * According to Long Backgammon rules:
   * - You can build a "fence" of 6 consecutive points with your checkers
   * - BUT: This is only allowed if there is at least one opponent checker AHEAD of the fence (in the direction of opponent's movement)
   * - Building a fence of 6 points when opponent has no checkers ahead (i.e., locking them completely in their head) is forbidden
   */
  private checkBlockRule(state: LongBoardState, to: number): boolean {
    const player = state.currentPlayer;
    const opponentSign = player === 0 ? -1 : 1;
    
    // Check if placing a checker here would create a 6-point block
    // We need to check all possible 6-point sequences
    for (let start = 0; start < this.BOARD_SIZE; start++) {
      let blockCount = 0;
      let hasOpponentInBlock = false;
      let hasOpponentAhead = false;
      
      // Check 6 consecutive points (circular)
      for (let i = 0; i < 6; i++) {
        const pointIdx = (start + i) % this.BOARD_SIZE;
        const pointValue = state.points[pointIdx] || 0;
        
        // Check if this point would be part of our block
        const wouldBeOurs = (pointIdx === to && player === 0) || 
                           (pointIdx === to && player === 1) ||
                           (player === 0 && pointValue > 0) ||
                           (player === 1 && pointValue < 0);
        
        if (wouldBeOurs) {
          blockCount++;
        }
        
        // Check if opponent has checkers in this block
        if (pointValue * opponentSign > 0) {
          hasOpponentInBlock = true;
        }
      }
      
      // Check points AHEAD of the block (in opponent's movement direction)
      // Opponent moves counter-clockwise, so "ahead" means points after the block
      for (let i = 6; i < this.BOARD_SIZE; i++) {
        const pointIdx = (start + i) % this.BOARD_SIZE;
        const pointValue = state.points[pointIdx] || 0;
        
        // Check if opponent has checkers ahead
        if (pointValue * opponentSign > 0) {
          hasOpponentAhead = true;
          break; // Found at least one opponent checker ahead
        }
      }
      
      // If we have a 6-point block and no opponent ahead (and no opponent in block), this is illegal
      // The block must contain our checkers and the new position
      if (blockCount === 6 && !hasOpponentAhead && !hasOpponentInBlock) {
        // Check if 'to' is part of this block
        let toInBlock = false;
        for (let i = 0; i < 6; i++) {
          const pointIdx = (start + i) % this.BOARD_SIZE;
          if (pointIdx === to) {
            toInBlock = true;
            break;
          }
        }
        
        if (toInBlock) {
          return false; // Illegal: creating a 6-point block with no opponent ahead
        }
      }
    }
    
    return true;
  }

  validateMove(state: LongBoardState, from: number, to: number, die: number): boolean {
    if (state.currentPlayer === 0) {
      return this.validateMovePlayer1(state, from, to, die);
    } else {
      return this.validateMovePlayer2(state, from, to, die);
    }
  }

  /**
   * Validate move using sum of two dice (for combined moves)
   * This is used when player wants to combine two dice into one move
   */
  private validateMoveWithSum(state: LongBoardState, from: number, to: number, die1: number, die2: number): boolean {
    const sumDie = die1 + die2;
    // Use regular validation with the sum
    return this.validateMove(state, from, to, sumDie);
  }

  private validateMovePlayer1(state: LongBoardState, from: number, to: number, die: number): boolean {
    // Handle bar entry (though not really used in Long)
    if (state.bar[0] > 0) {
      if (from !== -1) return false;
      const enterPoint = (this.WHITE_HEAD + die) % this.BOARD_SIZE;
      if (state.points[enterPoint] < 0) return false;
      return to === enterPoint || to === -1;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] <= 0) return false;

    // Расчет расстояния
    const distanceTraveled = (from - this.WHITE_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE;
    
    // Проверка на вынос (bearing off)
    if (distanceTraveled + die >= this.BOARD_SIZE) {
      if (!this.canBearOff(state, 0)) return false;
      if (!this.isInHome(0, from)) return false;
      
      const pToFinish = this.BOARD_SIZE - distanceTraveled; // 1-6
      
      if (die === pToFinish) {
        return to === -1 || to >= this.BOARD_SIZE;
      }
      
      if (die > pToFinish) {
        // Можно сбросить только если дальше от края (в доме) никого нет
        // "Дальше" в доме белых - это меньшие индексы (18, 19...)
        for (let i = this.WHITE_HOME_START; i < from; i++) {
          if (state.points[i] > 0) return false;
        }
        return to === -1 || to >= this.BOARD_SIZE;
      }
      return false; // die < pToFinish
    }

    const calculatedTo = (from + die) % this.BOARD_SIZE;
    if (to !== calculatedTo) return false;
    if (state.points[to] < 0) return false;
    
    // Проверяем правило дублей для ЛЮБОЙ точки (не только головы)
    // Дубль определяется по тому, что все кубики одинаковые (может быть 2, 3 или 4 кубика)
    const isDoubles = state.dice && state.dice.length >= 2 && state.dice.every(d => d === state.dice[0]);
    if (isDoubles) {
      const movesFromThisPoint = (state.movesFromPoint || {})[from] || 0;
      if (movesFromThisPoint >= 2) {
        // Больше двух шашек из одной точки нельзя
        return false;
      }
    } else {
      // Для обычных ходов проверяем правило головы
      if (!this.checkHeadRule(state, from, state.dice)) return false;
    }
    
    if (!this.checkBlockRule(state, to)) return false;
    
    return true;
  }

  private validateMovePlayer2(state: LongBoardState, from: number, to: number, die: number): boolean {
    if (state.bar[1] > 0) {
      if (from !== -1) return false;
      const enterPoint = (this.BLACK_HEAD - die + this.BOARD_SIZE) % this.BOARD_SIZE;
      if (state.points[enterPoint] > 0) return false;
      return to === enterPoint || to === -1;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] >= 0) return false;

    const distanceTraveled = (from - this.BLACK_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE;
    
    if (distanceTraveled + die >= this.BOARD_SIZE) {
      if (!this.canBearOff(state, 1)) return false;
      if (!this.isInHome(1, from)) return false;
      
      const pToFinish = this.BOARD_SIZE - distanceTraveled;
      
      if (die === pToFinish) {
        return to === -1 || to < 0 || to >= this.BOARD_SIZE;
      }
      
      if (die > pToFinish) {
        // "Дальше" в доме черных - это меньшие distanceTraveled.
        // Дом черных: Point 13-18 (indices 6-11).
        // Distance traveled: 
        // Index 6: (6-12+24)%24 = 18
        // Index 11: (11-12+24)%24 = 23
        // "Дальше" от выхода значит МЕНЬШЕЕ расстояние.
        for (let i = 0; i < this.BOARD_SIZE; i++) {
          if (state.points[i] < 0) {
            const d = (i - this.BLACK_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE;
            if (d < distanceTraveled) return false; 
          }
        }
        return to === -1 || to < 0 || to >= this.BOARD_SIZE;
      }
      return false;
    }

    const calculatedTo = (from + die) % this.BOARD_SIZE;
    if (to !== calculatedTo) return false;
    if (state.points[to] > 0) return false;
    
    // Проверяем правило дублей для ЛЮБОЙ точки (не только головы)
    // Дубль определяется по тому, что все кубики одинаковые (может быть 2, 3 или 4 кубика)
    const isDoubles = state.dice && state.dice.length >= 2 && state.dice.every(d => d === state.dice[0]);
    if (isDoubles) {
      const movesFromThisPoint = (state.movesFromPoint || {})[from] || 0;
      if (movesFromThisPoint >= 2) {
        // Больше двух шашек из одной точки нельзя
        return false;
      }
    } else {
      // Для обычных ходов проверяем правило головы
      if (!this.checkHeadRule(state, from, state.dice)) return false;
    }
    
    if (!this.checkBlockRule(state, to)) return false;
    
    return true;
  }

  canBearOff(state: LongBoardState, player: number): boolean {
    if (player === 0) {
      // White: all checkers must be in home (indices 18-23, Points 1-6)
      for (let i = 0; i < this.WHITE_HOME_START; i++) {
        if (state.points[i] > 0) return false;
      }
      return state.bar[0] === 0;
    } else {
      // Black: all checkers must be in home (indices 6-11, Points 13-18)
      // indices outside home: 0-5 and 12-23
      for (let i = 0; i < this.BLACK_HOME_START; i++) {
        if (state.points[i] < 0) return false;
      }
      for (let i = 12; i < this.BOARD_SIZE; i++) {
        if (state.points[i] < 0) return false;
      }
      return state.bar[1] === 0;
    }
  }

  applyMove(state: LongBoardState, from: number, to: number, die: number): LongBoardState {
    const newState = JSON.parse(JSON.stringify(state));

    if (newState.currentPlayer === 0) {
      this.applyMovePlayer1(newState, from, to, die);
    } else {
      this.applyMovePlayer2(newState, from, to, die);
    }

    return newState;
  }

  private applyMovePlayer1(state: LongBoardState, from: number, to: number, die: number): void {
    // Handle bar entry
    if (state.bar[0] > 0 && from === -1) {
      state.bar[0]--;
      const enterPoint = (this.WHITE_HEAD + die) % this.BOARD_SIZE;
      if (enterPoint >= 0 && enterPoint < this.BOARD_SIZE && state.points[enterPoint] >= 0) {
        state.points[enterPoint]++;
      } else {
        // Invalid entry, return checker to bar
        state.bar[0]++;
      }
      return;
    }

    // Handle bearing off
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
      
      // Track moves from head for Head Rule
      if (from === this.WHITE_HEAD) {
        state.movesFromHead = (state.movesFromHead || 0) + 1;
      }
      
      // Track moves from each point for Doubles Rule
      if (!state.movesFromPoint) {
        state.movesFromPoint = {};
      }
      state.movesFromPoint[from] = (state.movesFromPoint[from] || 0) + 1;
      
      // Cannot place on opponent's point (already validated, but double-check)
      if (state.points[to] < 0) {
        // Return checker
        state.points[from]++;
        if (from === this.WHITE_HEAD) {
          state.movesFromHead = Math.max(0, (state.movesFromHead || 0) - 1);
        }
        state.movesFromPoint[from] = Math.max(0, (state.movesFromPoint[from] || 0) - 1);
        return;
      }
      
      state.points[to]++;
    }
  }

  private applyMovePlayer2(state: LongBoardState, from: number, to: number, die: number): void {
    // Handle bar entry
    if (state.bar[1] > 0 && from === -1) {
      state.bar[1]--;
      const enterPoint = (this.BLACK_HEAD - die + this.BOARD_SIZE) % this.BOARD_SIZE;
      if (enterPoint >= 0 && enterPoint < this.BOARD_SIZE && state.points[enterPoint] <= 0) {
        state.points[enterPoint]--;
      } else {
        // Invalid entry, return checker to bar
        state.bar[1]++;
      }
      return;
    }

    // Handle bearing off
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
      
      // Track moves from head for Head Rule
      if (from === this.BLACK_HEAD) {
        state.movesFromHead = (state.movesFromHead || 0) + 1;
      }
      
      // Track moves from each point for Doubles Rule
      if (!state.movesFromPoint) {
        state.movesFromPoint = {};
      }
      state.movesFromPoint[from] = (state.movesFromPoint[from] || 0) + 1;
      
      // Cannot place on opponent's point (already validated, but double-check)
      if (state.points[to] > 0) {
        // Return checker
        state.points[from]--;
        if (from === this.BLACK_HEAD) {
          state.movesFromHead = Math.max(0, (state.movesFromHead || 0) - 1);
        }
        state.movesFromPoint[from] = Math.max(0, (state.movesFromPoint[from] || 0) - 1);
        return;
      }
      
      state.points[to]--;
    }
  }

  isGameFinished(state: LongBoardState): boolean {
    return state.borneOff[0] === 15 || state.borneOff[1] === 15;
  }

  getWinner(state: LongBoardState): number | null {
    if (state.borneOff[0] === 15) return 0;
    if (state.borneOff[1] === 15) return 1;
    return null;
  }

  getAllValidMoves(state: LongBoardState, dice: number[]): Array<Array<{ from: number; to: number; die: number }>> {
    if (dice.length === 0) return [];

    const moves: Array<Array<{ from: number; to: number; die: number }>> = [];
    // Дубль определяется по тому, что все кубики одинаковые (может быть 2, 3 или 4 кубика)
    // Изначально дубль - это 4 одинаковых кубика, но после использования одного может остаться 3
    const isDoubles = dice.length >= 2 && dice.every(d => d === dice[0]);
    
    const generateMoves = (
      currentState: LongBoardState,
      remainingDice: number[],
      currentMoves: Array<{ from: number; to: number; die: number }>,
    ): void => {
      if (remainingDice.length === 0) {
        if (currentMoves.length > 0) {
          moves.push([...currentMoves]);
        }
        return;
      }

      const player = currentState.currentPlayer;
      
      // Find all possible moves from board
      let foundAnyMove = false;
      
      for (let from = 0; from < this.BOARD_SIZE; from++) {
        const pointValue = currentState.points[from];
        const hasMyCheckers = player === 0 ? pointValue > 0 : pointValue < 0;
        
        if (!hasMyCheckers) continue;

        // Для дублей: проверяем, сколько шашек уже вышло из этой точки
        const movesFromThisPoint = (currentState.movesFromPoint || {})[from] || 0;
        if (isDoubles && movesFromThisPoint >= 2) {
          // Уже выведено 2 шашки из этой точки - больше нельзя
          continue;
        }

        // Для дублей используем ВСЕ кубики по порядку (не пропускаем дубликаты)
        // Для обычных ходов можем оптимизировать
        const isRemainingDoubles = remainingDice.length >= 2 && remainingDice.every(d => d === remainingDice[0]);
        const triedDice = isRemainingDoubles ? null : new Set<number>();
        
        for (let i = 0; i < remainingDice.length; i++) {
          const die = remainingDice[i];
          // Для дублей НЕ пропускаем дубликаты - используем каждый кубик
          if (!isRemainingDoubles && triedDice && triedDice.has(die)) continue;
          if (!isRemainingDoubles && triedDice) triedDice.add(die);
          
          // Пробуем обычный ход
          const toPoint = this.calculateTargetPoint(player, from, die);
          
          // Проверяем на вынос
          const distanceTraveled = player === 0 
            ? (from - this.WHITE_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE
            : (from - this.BLACK_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE;
          
          const isBearingOffMove = (distanceTraveled + die) >= this.BOARD_SIZE;
          const to = isBearingOffMove ? -1 : toPoint;

          if (this.validateMove(currentState, from, to, die)) {
            foundAnyMove = true;
            const newState = this.applyMove(currentState, from, to, die);
            const newDice = [...remainingDice];
            newDice.splice(i, 1);
            generateMoves(newState, newDice, [...currentMoves, { from, to, die }]);
          }
          
          // Для длинных нард: также пробуем комбинированные ходы (сумма двух кубиков)
          // Это позволяет ходить через доски (например, 1+1=2 через доску)
          if (remainingDice.length >= 2 && !isRemainingDoubles) {
            for (let j = i + 1; j < remainingDice.length; j++) {
              const die2 = remainingDice[j];
              const sumDie = die + die2;
              
              // Пробуем ход с суммой кубиков
              const toPointSum = this.calculateTargetPoint(player, from, sumDie);
              const distanceTraveledSum = player === 0 
                ? (from - this.WHITE_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE
                : (from - this.BLACK_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE;
              
              const isBearingOffMoveSum = (distanceTraveledSum + sumDie) >= this.BOARD_SIZE;
              const toSum = isBearingOffMoveSum ? -1 : toPointSum;
              
              if (this.validateMove(currentState, from, toSum, sumDie)) {
                foundAnyMove = true;
                const newStateSum = this.applyMove(currentState, from, toSum, sumDie);
                const newDiceSum = [...remainingDice];
                newDiceSum.splice(j, 1);
                newDiceSum.splice(i, 1);
                generateMoves(newStateSum, newDiceSum, [...currentMoves, { from, to: toSum, die: sumDie }]);
              }
            }
          }
        }
      }
      
      if (!foundAnyMove && currentMoves.length > 0) {
        moves.push([...currentMoves]);
      }
    };

    generateMoves(state, dice, []);
    
    if (moves.length === 0) return [[]];

    const maxLength = Math.max(...moves.map((m) => m.length));
    return moves.filter((m) => m.length === maxLength);
  }
}
