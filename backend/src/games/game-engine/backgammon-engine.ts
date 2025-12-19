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
    0, 2, 0, 0, 0, 0, -5, 0, -3, 0, 0, 0, 5, -5, 0, 0, 0, 3, 0, 5, 0, 0, 0, -2, 0,
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
    if (state.bar[0] > 0) {
      if (from !== -1) return false;
      const enterPoint = 24 - die;
      if (state.points[enterPoint] < -1) return false;
      return true;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] <= 0) return false;

    const toPoint = from - die;
    if (toPoint < 0) {
      if (this.canBearOff(state, 0)) {
        return true;
      }
      return false;
    }

    if (state.points[toPoint] < -1) return false;
    return true;
  }

  private validateMovePlayer2(state: BoardState, from: number, to: number, die: number): boolean {
    if (state.bar[1] > 0) {
      if (from !== -1) return false;
      const enterPoint = die - 1;
      if (state.points[enterPoint] > 1) return false;
      return true;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] >= 0) return false;

    const toPoint = from + die;
    if (toPoint >= this.BOARD_SIZE) {
      if (this.canBearOff(state, 1)) {
        return true;
      }
      return false;
    }

    if (state.points[toPoint] > 1) return false;
    return true;
  }

  canBearOff(state: BoardState, player: number): boolean {
    if (player === 0) {
      const homeBoard = state.points.slice(18, 24);
      const allInHome = homeBoard.every((p) => p >= 0);
      return allInHome && state.bar[0] === 0;
    } else {
      const homeBoard = state.points.slice(0, 6);
      const allInHome = homeBoard.every((p) => p <= 0);
      return allInHome && state.bar[1] === 0;
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
    if (state.bar[0] > 0 && from === -1) {
      state.bar[0]--;
      const enterPoint = 24 - die;
      if (state.points[enterPoint] === -1) {
        state.points[enterPoint] = 1;
        state.bar[1]++;
      } else {
        state.points[enterPoint]++;
      }
      return;
    }

    if (to < 0) {
      state.points[from]--;
      state.borneOff[0]++;
      return;
    }

    state.points[from]--;
    if (state.points[to] === -1) {
      state.points[to] = 1;
      state.bar[1]++;
    } else {
      state.points[to]++;
    }
  }

  private applyMovePlayer2(state: BoardState, from: number, to: number, die: number): void {
    if (state.bar[1] > 0 && from === -1) {
      state.bar[1]--;
      const enterPoint = die - 1;
      if (state.points[enterPoint] === 1) {
        state.points[enterPoint] = -1;
        state.bar[0]++;
      } else {
        state.points[enterPoint]--;
      }
      return;
    }

    if (to >= this.BOARD_SIZE) {
      state.points[from]++;
      state.borneOff[1]++;
      return;
    }

    state.points[from]++;
    if (state.points[to] === 1) {
      state.points[to] = -1;
      state.bar[0]++;
    } else {
      state.points[to]--;
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

  getAllValidMoves(state: BoardState, dice: number[]): any[] {
    const moves: any[] = [];
    const usedDice: boolean[] = new Array(dice.length).fill(false);

    const findMoves = (currentState: BoardState, remainingDice: number[], path: any[]): void => {
      if (remainingDice.length === 0) {
        moves.push([...path]);
        return;
      }

      for (let i = 0; i < remainingDice.length; i++) {
        const die = remainingDice[i];
        const possibleMoves = this.getPossibleMovesForDie(currentState, die);

        for (const move of possibleMoves) {
          const newState = this.applyMove(currentState, move.from, move.to, die);
          const newDice = remainingDice.filter((_, idx) => idx !== i);
          findMoves(newState, newDice, [...path, move]);
        }
      }
    };

    findMoves(state, dice, []);
    return moves.length > 0 ? moves : [];
  }

  private getPossibleMovesForDie(state: BoardState, die: number): any[] {
    const moves: any[] = [];

    if (state.currentPlayer === 0) {
      if (state.bar[0] > 0) {
        const enterPoint = 24 - die;
        if (this.validateMove(state, -1, enterPoint, die)) {
          moves.push({ from: -1, to: enterPoint });
        }
      } else {
        for (let from = 0; from < this.BOARD_SIZE; from++) {
          if (state.points[from] > 0) {
            const to = from - die;
            if (this.validateMove(state, from, to, die)) {
              moves.push({ from, to });
            }
          }
        }
      }
    } else {
      if (state.bar[1] > 0) {
        const enterPoint = die - 1;
        if (this.validateMove(state, -1, enterPoint, die)) {
          moves.push({ from: -1, to: enterPoint });
        }
      } else {
        for (let from = 0; from < this.BOARD_SIZE; from++) {
          if (state.points[from] < 0) {
            const to = from + die;
            if (this.validateMove(state, from, to, die)) {
              moves.push({ from, to });
            }
          }
        }
      }
    }

    return moves;
  }
}

