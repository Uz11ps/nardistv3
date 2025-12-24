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
   * Exception: Doubles on first move allow multiple checkers (up to 2) ONLY if one checker cannot make the full move due to blocked points
   * 
   * According to Long Backgammon rules:
   * - In a complete turn (using all dice), you can take maximum 1 checker from head
   * - Exception: If doubles are rolled on the FIRST move of the game, AND one checker cannot make the full move due to blocked points,
   *   then player can move 2 checkers from head
   * - This rule applies to the entire turn, not individual moves
   * 
   * Examples:
   * - With dice [6, 3]: Can take 1 checker from head and move it 6, then move another checker (not from head) 3
   * - With dice [6, 3]: Can take 1 checker from head and move it 9 (combining dice)
   * - With dice [6, 3]: Cannot take 2 checkers from head in the same turn
   * - With doubles [3, 3] on first move: Can take 2 checkers if one checker cannot make all 4 moves due to blocked points
   */
  private checkHeadRule(state: LongBoardState, from: number, dice: number[]): boolean {
    const player = state.currentPlayer;
    const headIndex = player === 0 ? this.WHITE_HEAD : this.BLACK_HEAD;
    
    // If not moving from head, rule doesn't apply
    if (from !== headIndex) {
      return true;
    }
    
    // Check if this is the first turn of the game for this player
    const currentHeadCheckers = Math.abs(state.points[headIndex] || 0);
    const movedThisTurn = state.movesFromHead || 0;
    const wasFirstTurn = (currentHeadCheckers + movedThisTurn) === 15;
    
    // Check if it's a doubles turn
    // In Long Backgammon, doubles are expanded to 4 dice. 
    // Even if some are used, the remaining will all have the same value.
    const isDoubles = dice.length > 0 && dice.every(d => d === dice[0]) && (state.dice.length === 2 || state.dice.length === 3 || state.dice.length === 4);
    const dieValue = dice[0];
    const isSpecialDouble = isDoubles && (dieValue === 3 || dieValue === 4 || dieValue === 6);
    
    console.log(`🔍 checkHeadRule debug:`, {
      from,
      movedThisTurn,
      wasFirstTurn,
      isDoubles,
      dieValue,
      isSpecialDouble,
      dice
    });
    
    // Exception: 3:3, 4:4, 6:6 on the FIRST turn allow taking 2 checkers from head
    if (wasFirstTurn && isSpecialDouble) {
      return movedThisTurn < 2;
    }
    
    // Otherwise, only 1 checker per turn from head
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
    // Handle bar entry
    if (state.bar[0] > 0) {
      if (from !== -1) return false;
      // White enters from bar: starts at Point 24 (index 0), moves counter-clockwise
      // With die value, enters on point (24 - die) = index die (moving counter-clockwise from head)
      // White head is at index 0 (Point 24), so with die=1, enters at index 1 (Point 23), etc.
      const enterPoint = (this.WHITE_HEAD + die) % this.BOARD_SIZE;
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE) return false;
      // Cannot enter on opponent's point
      if (state.points[enterPoint] < 0) return false;
      return to === enterPoint || to === -1;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] <= 0) return false;

    // Calculate target point
    const calculatedTo = this.calculateTargetPoint(0, from, die);
    const distanceTraveled = (from - this.WHITE_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE;
    
    // Handle bearing off
    // White home: indices 18-23 (Points 1-6)
    // Journey: 0 -> 1 -> ... -> 23 -> OFF
    if (distanceTraveled + die >= this.BOARD_SIZE) {
      if (!this.canBearOff(state, 0)) {
        return false;
      }
      
      // Check if from point is in home
      if (!this.isInHome(0, from)) {
        return false;
      }
      
      // Standard bearing off rules:
      // 1. Can bear off if die exactly matches point distance to finish
      // 2. Can bear off from further point if die is greater AND no checkers on points further from finish
      
      const pToFinish = this.BOARD_SIZE - distanceTraveled; // 1 to 6
      
      if (die === pToFinish) {
        return to === -1 || to >= this.BOARD_SIZE;
      }
      
      if (die > pToFinish) {
        // Check if there are any checkers further from finish (lower indices in white home)
        for (let i = this.WHITE_HOME_START; i < from; i++) {
          if (state.points[i] > 0) return false; // Must move/bear off from further points first
        }
        return to === -1 || to >= this.BOARD_SIZE;
      }
      
      return false; // die < pToFinish, must move within home
    }

    if (to !== calculatedTo) {
      return false;
    }

    // Cannot move to opponent's point
    if (state.points[to] < 0) return false;
    
    // Check Head Rule
    if (!this.checkHeadRule(state, from, state.dice)) {
      return false;
    }
    
    // Check Block Rule
    if (!this.checkBlockRule(state, to)) {
      return false;
    }
    
    return true;
  }

  private validateMovePlayer2(state: LongBoardState, from: number, to: number, die: number): boolean {
    // Handle bar entry
    if (state.bar[1] > 0) {
      if (from !== -1) return false;
      // Black enters from bar: starts at Point 12 (index 12), moves counter-clockwise
      // With die value, enters on point (12 + die - 1) modulo 24, but we need to calculate from head
      // Black head is at index 12 (Point 12), so with die=1, enters at index 11 (Point 13), etc.
      // Actually, in Long Backgammon, bar entry uses die value to move from head counter-clockwise
      // Black head is index 12, so die=1 → index 11, die=2 → index 10, etc.
      const enterPoint = (this.BLACK_HEAD - die + this.BOARD_SIZE) % this.BOARD_SIZE;
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE) return false;
      // Cannot enter on opponent's point
      if (state.points[enterPoint] > 0) return false;
      return to === enterPoint || to === -1;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] >= 0) return false;

    // Calculate target point
    const calculatedTo = this.calculateTargetPoint(1, from, die);
    const distanceTraveled = (from - this.BLACK_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE;
    
    // Handle bearing off
    // Black home: indices 6-11 (Points 13-18)
    // Journey: 12 -> 13 -> ... -> 23 -> 0 -> ... -> 11 -> OFF
    if (distanceTraveled + die >= this.BOARD_SIZE) {
      if (!this.canBearOff(state, 1)) {
        return false;
      }
      
      // Check if from point is in home
      if (!this.isInHome(1, from)) {
        return false;
      }
      
      // Standard bearing off rules:
      const pToFinish = this.BOARD_SIZE - distanceTraveled; // 1 to 6
      
      if (die === pToFinish) {
        return to === -1 || to >= this.BOARD_SIZE;
      }
      
      if (die > pToFinish) {
        // Check if there are any checkers further from finish (lower distances in black home)
        // Indices 6, 7, 8, 9, 10, 11 (distanceTraveled 18, 19, 20, 21, 22, 23)
        for (let i = this.BLACK_HOME_START; i < from; i++) {
          if (state.points[i] < 0) return false;
        }
        return to === -1 || to >= this.BOARD_SIZE;
      }
      
      return false;
    }

    if (to !== calculatedTo) {
      return false;
    }

    // Cannot move to opponent's point
    if (state.points[to] > 0) return false;
    
    // Check Head Rule
    if (!this.checkHeadRule(state, from, state.dice)) {
      return false;
    }
    
    // Check Block Rule
    if (!this.checkBlockRule(state, to)) {
      return false;
    }
    
    return true;
  }

  canBearOff(state: LongBoardState, player: number): boolean {
    if (player === 0) {
      // White: all checkers must be in home (indices 18-23, Points 1-6) and none on bar
      const homeBoard = state.points.slice(this.WHITE_HOME_START, this.BOARD_SIZE);
      const allInHome = homeBoard.every((p) => p >= 0);
      const noBarCheckers = state.bar[0] === 0;
      // Also check that no checkers are outside home
      const outsideHome = state.points.slice(0, this.WHITE_HOME_START).some((p) => p > 0);
      return allInHome && noBarCheckers && !outsideHome;
    } else {
      // Black: all checkers must be in home (indices 6-11, Points 13-18) and none on bar
      const homeBoard = state.points.slice(this.BLACK_HOME_START, 12);
      const allInHome = homeBoard.every((p) => p <= 0);
      const noBarCheckers = state.bar[1] === 0;
      // Also check that no checkers are outside home
      const outsideHome = state.points.slice(0, this.BLACK_HOME_START).some((p) => p < 0) ||
                         state.points.slice(12).some((p) => p < 0);
      return allInHome && noBarCheckers && !outsideHome;
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
      
      // Cannot place on opponent's point (already validated, but double-check)
      if (state.points[to] < 0) {
        // Return checker
        state.points[from]++;
        if (from === this.WHITE_HEAD) {
          state.movesFromHead = Math.max(0, (state.movesFromHead || 0) - 1);
        }
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
      
      // Cannot place on opponent's point (already validated, but double-check)
      if (state.points[to] > 0) {
        // Return checker
        state.points[from]--;
        if (from === this.BLACK_HEAD) {
          state.movesFromHead = Math.max(0, (state.movesFromHead || 0) - 1);
        }
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
      const headIndex = player === 0 ? this.WHITE_HEAD : this.BLACK_HEAD;

      // Find all possible moves from board
      let foundAnyMove = false;
      
      for (let from = 0; from < this.BOARD_SIZE; from++) {
        const pointValue = currentState.points[from];
        const hasMyCheckers = player === 0 ? pointValue > 0 : pointValue < 0;
        
        if (!hasMyCheckers) continue;

        const triedDice = new Set<number>();
        for (let i = 0; i < remainingDice.length; i++) {
          const die = remainingDice[i];
          if (triedDice.has(die)) continue;
          triedDice.add(die);
          
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
        }
      }
      
      // ... (rest of the logic for combining dice if needed, but Long Backgammon usually uses dice separately)
      // В длинных нардах кубики используются по отдельности.
      
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
