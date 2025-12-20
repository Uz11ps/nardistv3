import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface LongBoardState {
  points: number[];
  bar: [number, number];
  borneOff: [number, number];
  currentPlayer: number;
  dice: number[];
}

@Injectable()
export class LongBackgammonEngine {
  private readonly BOARD_SIZE = 24;
  // Начальная позиция для длинных нард:
  // Белые (положительные): 15 фишек на точке 1
  // Черные (отрицательные): 15 фишек на точке 13
  private readonly INITIAL_BOARD = [
    0, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ];

  createInitialState(): LongBoardState {
    return {
      points: [...this.INITIAL_BOARD],
      bar: [0, 0],
      borneOff: [0, 0],
      currentPlayer: 0,
      dice: [],
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

  validateMove(state: LongBoardState, from: number, to: number, die: number): boolean {
    if (state.currentPlayer === 0) {
      return this.validateMovePlayer1(state, from, to, die);
    } else {
      return this.validateMovePlayer2(state, from, to, die);
    }
  }

  private validateMovePlayer1(state: LongBoardState, from: number, to: number, die: number): boolean {
    if (state.bar[0] > 0) {
      if (from !== -1) return false;
      const enterPoint = 24 - die;
      if (state.points[enterPoint] < 0) return false;
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

    if (state.points[toPoint] < 0) return false;
    return true;
  }

  private validateMovePlayer2(state: LongBoardState, from: number, to: number, die: number): boolean {
    if (state.bar[1] > 0) {
      if (from !== -1) return false;
      const enterPoint = die - 1;
      if (state.points[enterPoint] > 0) return false;
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

    if (state.points[toPoint] > 0) return false;
    return true;
  }

  canBearOff(state: LongBoardState, player: number): boolean {
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
    if (state.bar[0] > 0 && from === -1) {
      state.bar[0]--;
      const enterPoint = 24 - die;
      state.points[enterPoint]++;
      return;
    }

    if (to < 0) {
      state.points[from]--;
      state.borneOff[0]++;
      return;
    }

    state.points[from]--;
    state.points[to]++;
  }

  private applyMovePlayer2(state: LongBoardState, from: number, to: number, die: number): void {
    if (state.bar[1] > 0 && from === -1) {
      state.bar[1]--;
      const enterPoint = die - 1;
      if (state.points[enterPoint] > 0) {
        // Если на точке есть фишки белых, их сбиваем на бар
        state.bar[0] += state.points[enterPoint];
      }
      state.points[enterPoint] = -1; // Ставим черную фишку
      return;
    }

    if (to >= this.BOARD_SIZE || to === -1) {
      // Вынос для черных (to >= 24 или to === -1 для белых)
      if (state.points[from] < 0) {
        state.points[from]++;
        state.borneOff[1]++;
      }
      return;
    }

    // Обычный ход
    if (state.points[from] < 0) {
      state.points[from]++;
    }
    
    if (state.points[to] > 0) {
      // Если на точке есть фишки белых, их сбиваем на бар
      state.bar[0] += state.points[to];
      state.points[to] = -1;
    } else {
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
}

