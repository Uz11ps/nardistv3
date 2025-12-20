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
  // Coordinate system:
  // Index 0 = Point 24 (Top Right)
  // Index 11 = Point 13 (Top Left)
  // Index 12 = Point 12 (Bottom Left)
  // Index 23 = Point 1 (Bottom Right)
  // White (positive): 15 checkers on Point 13 (index 11)
  // Black (negative): 15 checkers on Point 1 (index 23)
  private readonly INITIAL_BOARD = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -15,
  ];
  
  // Head positions (starting points)
  private readonly WHITE_HEAD = 11; // Point 13
  private readonly BLACK_HEAD = 23; // Point 1
  
  // Home quadrants
  private readonly WHITE_HOME_START = 18; // Point 19-24 (indices 18-23)
  private readonly BLACK_HOME_START = 0; // Point 1-6 (indices 0-5)

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
   * White moves: decreasing indices (11 -> 0, then 23 -> 12)
   * Black moves: decreasing indices (23 -> 12, then 11 -> 0)
   */
  private calculateTargetPoint(player: number, from: number, die: number): number {
    if (player === 0) {
      // White: moves from index 11 towards 0, then wraps to 23 and continues to 12
      let to = from - die;
      
      // If we go below 0, we wrap around
      if (to < 0) {
        // We've wrapped: continue from index 23
        to = 23 + to + 1; // to is negative, so this gives us the correct wrap
      }
      
      // If we're in the first half (0-11) and go below 12, we need to wrap
      if (from >= 12 && to < 12) {
        // We've crossed from second half to first half
        const overflow = 12 - to;
        to = 23 - (overflow - 1);
      }
      
      return to;
    } else {
      // Black: moves from index 23 towards 12, then wraps to 11 and continues to 0
      let to = from - die;
      
      // If we go below 0, wrap around
      if (to < 0) {
        to = 23 + to + 1;
      }
      
      // If we're in the second half (12-23) and go below 12, wrap
      if (from >= 12 && to < 12) {
        const overflow = 12 - to;
        to = 11 - (overflow - 1);
        if (to < 0) {
          to = 23 + to + 1;
        }
      }
      
      return to;
    }
  }

  /**
   * Check if a point is in the player's home quadrant
   */
  private isInHome(player: number, pointIndex: number): boolean {
    if (player === 0) {
      return pointIndex >= this.WHITE_HOME_START && pointIndex < this.BOARD_SIZE;
    } else {
      return pointIndex >= this.BLACK_HOME_START && pointIndex < 6;
    }
  }

  /**
   * Check Head Rule: Only 1 checker can be moved from head per turn
   * Exception: Doubles on first move allow multiple checkers (up to 2)
   * 
   * According to Long Backgammon rules:
   * - On first move from head, normally only 1 checker can be moved
   * - Exception: If doubles are rolled on the FIRST move, player can move 2 checkers from head
   * - On subsequent moves, only 1 checker per turn can be moved from head
   */
  private checkHeadRule(state: LongBoardState, from: number, dice: number[]): boolean {
    const player = state.currentPlayer;
    const headIndex = player === 0 ? this.WHITE_HEAD : this.BLACK_HEAD;
    
    // If not moving from head, rule doesn't apply
    if (from !== headIndex) {
      return true;
    }
    
    // Check if this is the first move of the game for this player
    // We check: current checkers on head + checkers moved from head this turn = 15
    // This tells us how many were on head at the start of this turn
    const currentHeadCheckers = Math.abs(state.points[headIndex] || 0);
    const movedThisTurn = state.movesFromHead || 0;
    const wasFirstTurn = (currentHeadCheckers + movedThisTurn) === 15;
    
    // Check if doubles are rolled
    // Doubles can be: [x, x] (2 dice) or [x, x, x, x] (4 dice after expansion)
    const isDoubles = (dice.length === 2 && dice[0] === dice[1]) || 
                      (dice.length === 4 && dice[0] === dice[1] && dice[1] === dice[2] && dice[2] === dice[3]);
    
    // If first move and doubles, allow up to 2 checkers from head
    if (wasFirstTurn && isDoubles) {
      // Allow up to 2 checkers from head on first move with doubles
      return movedThisTurn < 2;
    }
    
    // Otherwise, only 1 checker per turn from head
    return movedThisTurn === 0;
  }

  /**
   * Check Block Rule: Cannot create a block of 6 consecutive points if no opponent checker is ahead
   */
  private checkBlockRule(state: LongBoardState, to: number): boolean {
    const player = state.currentPlayer;
    const opponentSign = player === 0 ? -1 : 1;
    
    // Check if placing a checker here would create a 6-point block
    // We need to check if there are 6 consecutive points with only our checkers
    for (let start = 0; start <= this.BOARD_SIZE - 6; start++) {
      let blockCount = 0;
      let hasOpponentAhead = false;
      
      // Check 6 consecutive points
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
        
        // Check if opponent has checkers ahead of this block
        if (pointValue * opponentSign > 0) {
          hasOpponentAhead = true;
        }
      }
      
      // If we have a 6-point block and no opponent ahead, this is illegal
      if (blockCount === 6 && !hasOpponentAhead && 
          to >= start && to < (start + 6) % this.BOARD_SIZE) {
        return false;
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

  private validateMovePlayer1(state: LongBoardState, from: number, to: number, die: number): boolean {
    // Handle bar entry
    if (state.bar[0] > 0) {
      if (from !== -1) return false;
      // White enters from bar: can enter on point (24 - die), which is index (die - 1)
      const enterPoint = die - 1;
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE) return false;
      // Cannot enter on opponent's point
      if (state.points[enterPoint] < 0) return false;
      return to === enterPoint || to === -1;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] <= 0) return false;

    // Calculate target point
    const calculatedTo = this.calculateTargetPoint(0, from, die);
    
    // Handle bearing off
    if (calculatedTo < 0 || (calculatedTo >= this.WHITE_HOME_START && this.canBearOff(state, 0))) {
      if (!this.canBearOff(state, 0)) {
        return false;
      }
      // Can bear off if all checkers are in home
      return to === -1 || to < 0;
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
      // Black enters from bar: can enter on point die, which is index (die - 1)
      const enterPoint = die - 1;
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE) return false;
      // Cannot enter on opponent's point
      if (state.points[enterPoint] > 0) return false;
      return to === enterPoint || to === -1;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] >= 0) return false;

    // Calculate target point
    const calculatedTo = this.calculateTargetPoint(1, from, die);
    
    // Handle bearing off
    if (calculatedTo < 0 || (calculatedTo < 6 && this.canBearOff(state, 1))) {
      if (!this.canBearOff(state, 1)) {
        return false;
      }
      return to === -1 || to >= this.BOARD_SIZE;
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
      // White: all checkers must be in home (indices 18-23) and none on bar
      const homeBoard = state.points.slice(this.WHITE_HOME_START, this.BOARD_SIZE);
      const allInHome = homeBoard.every((p) => p >= 0);
      const noBarCheckers = state.bar[0] === 0;
      // Also check that no checkers are outside home
      const outsideHome = state.points.slice(0, this.WHITE_HOME_START).some((p) => p > 0);
      return allInHome && noBarCheckers && !outsideHome;
    } else {
      // Black: all checkers must be in home (indices 0-5) and none on bar
      const homeBoard = state.points.slice(0, 6);
      const allInHome = homeBoard.every((p) => p <= 0);
      const noBarCheckers = state.bar[1] === 0;
      // Also check that no checkers are outside home
      const outsideHome = state.points.slice(6).some((p) => p < 0);
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
      const enterPoint = die - 1;
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
      const enterPoint = die - 1;
      if (enterPoint >= 0 && enterPoint < this.BOARD_SIZE && state.points[enterPoint] <= 0) {
        state.points[enterPoint]--;
      } else {
        // Invalid entry, return checker to bar
        state.bar[1]--;
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

  /**
   * Get all valid move combinations for current player
   */
  getAllValidMoves(state: LongBoardState, dice: number[]): Array<Array<{ from: number; to: number; die: number }>> {
    if (dice.length === 0) return [];

    const moves: Array<Array<{ from: number; to: number; die: number }>> = [];
    
    // Reset movesFromHead for new turn
    const stateWithReset = { ...state, movesFromHead: 0 };

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
      const hasBarCheckers = player === 0 ? currentState.bar[0] > 0 : currentState.bar[1] > 0;

      // If checkers on bar, must enter them first
      if (hasBarCheckers) {
        for (let i = 0; i < remainingDice.length; i++) {
          const die = remainingDice[i];
          const enterPoint = die - 1;
          
          if (this.validateMove(currentState, -1, enterPoint, die)) {
            const newState = this.applyMove(currentState, -1, enterPoint, die);
            const newDice = [...remainingDice];
            newDice.splice(i, 1);
            generateMoves(newState, newDice, [...currentMoves, { from: -1, to: enterPoint, die }]);
          }
        }
        return;
      }

      // Find all possible moves from board
      let foundAnyMove = false;
      for (let from = 0; from < this.BOARD_SIZE; from++) {
        const pointValue = currentState.points[from];
        const hasMyCheckers = player === 0 ? pointValue > 0 : pointValue < 0;
        
        if (!hasMyCheckers) continue;

        for (let i = 0; i < remainingDice.length; i++) {
          const die = remainingDice[i];
          
          // Calculate target point
          let to: number;
          const calculatedTo = this.calculateTargetPoint(player, from, die);
          
          // Check if bearing off
          if (calculatedTo < 0 || 
              (player === 0 && calculatedTo >= this.WHITE_HOME_START && this.canBearOff(currentState, 0)) ||
              (player === 1 && calculatedTo < 6 && this.canBearOff(currentState, 1))) {
            if (this.canBearOff(currentState, player)) {
              to = -1; // Bear off
            } else {
              continue; // Cannot bear off yet
            }
          } else {
            to = calculatedTo;
          }

          // Validate move
          if (this.validateMove(currentState, from, to, die)) {
            foundAnyMove = true;
            const newState = this.applyMove(currentState, from, to, die);
            const newDice = [...remainingDice];
            newDice.splice(i, 1);
            generateMoves(newState, newDice, [...currentMoves, { from, to, die }]);
          }
        }
      }

      // If no moves found but we have partial moves, save them
      if (!foundAnyMove && currentMoves.length > 0) {
        moves.push([...currentMoves]);
      }
    };

    generateMoves(stateWithReset, dice, []);
    
    // If no moves, return empty array (pass turn)
    if (moves.length === 0) {
      return [[]];
    }

    // Return maximum length move sequences
    const maxLength = Math.max(...moves.map((m) => m.length));
    return moves.filter((m) => m.length === maxLength);
  }
}
