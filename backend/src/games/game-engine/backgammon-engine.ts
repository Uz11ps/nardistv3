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
    1, 0, 0, 0, 0, -1, 0, -1, 0, 0, 0, 2, -2, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, -1
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

  /**
   * Calculate target point for a move
   * Coordinate system (matching frontend):
   * Index 0 = Point 24 (Top Right) - White starting area
   * Index 23 = Point 1 (Bottom Right) - Black starting area
   * White moves: 0→1→...→23 (Point 24→23→...→1) - increasing index
   * Black moves: 23→22→...→0 (Point 1→2→...→24) - decreasing index
   */
  private calculateTargetPoint(player: number, from: number, die: number): number {
    if (player === 0) {
      // White: moves by INCREASING index
      return from + die;
    } else {
      // Black: moves by DECREASING index
      return from - die;
    }
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
    // White enters in BLACK's home (opponent's home)
    // Black home is visually top right: Points 19-24 (indices 0-5)
    // White enters: die=1 → Point 24 → index 0, die=6 → Point 19 → index 5
    if (state.bar[0] > 0) {
      if (from !== -1) return false;
      const enterPoint = die - 1; // die=1 → 0 (Point 24), die=6 → 5 (Point 19)
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE) return false;
      if (state.points[enterPoint] < -1) return false;
      return to === enterPoint || to === -1;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] <= 0) return false;

    // Расчет цели для обычного хода
    const toPoint = this.calculateTargetPoint(0, from, die);
    
    // Проверка на вынос (bearing off)
    if (toPoint >= this.BOARD_SIZE) {
      if (!this.canBearOff(state, 0)) return false;
      
      const distanceToFinish = this.BOARD_SIZE - from; // Расстояние до края
      if (die === distanceToFinish) {
        return to === -1 || to >= this.BOARD_SIZE;
      }
      if (die > distanceToFinish) {
        // Можно сбросить только если дальше от края никого нет
        for (let i = 0; i < from; i++) {
          if (state.points[i] > 0) return false;
        }
        return to === -1 || to >= this.BOARD_SIZE;
      }
      return false;
    }

    if (to !== toPoint && to !== -1) return false;
    
    // Нельзя вставать на пункт, занятый 2+ шашками соперника (можно только на пустую или с 1 шашкой)
    if (state.points[toPoint] < -1) return false;
    
    return true;
  }

  private validateMovePlayer2(state: BoardState, from: number, to: number, die: number): boolean {
    // Player 2 (Black) moves from index 23 towards index 0 (Point 1 to 24)
    
    // If checkers on bar, must enter from bar first
    // Black enters in WHITE's home (opponent's home)
    // White home is visually bottom right: Points 1-6 (indices 18-23)
    // Black enters: die=1 → Point 1 → index 18, die=6 → Point 6 → index 23
    if (state.bar[1] > 0) {
      if (from !== -1) return false;
      const enterPointIndex = 17 + die; // die=1 → 18 (Point 1), die=6 → 23 (Point 6)
      if (enterPointIndex < 0 || enterPointIndex >= this.BOARD_SIZE) return false;
      if (state.points[enterPointIndex] > 1) return false;
      return to === enterPointIndex || to === -1;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] >= 0) return false;

    // Расчет цели для обычного хода
    const toPoint = this.calculateTargetPoint(1, from, die);
    
    if (toPoint < 0) {
      if (!this.canBearOff(state, 1)) return false;
      
      const distanceToFinish = from + 1;
      if (die === distanceToFinish) {
        return to === -1 || to < 0;
      }
      if (die > distanceToFinish) {
        // Можно сбросить только если дальше от края никого нет (от Point 19 до current)
        // Для черных "дальше" это бОльшие индексы (ближе к центру)
        for (let i = from + 1; i < 6; i++) {
          if (state.points[i] < 0) return false;
        }
        return to === -1 || to < 0;
      }
      return false;
    }

    if (to !== toPoint && to !== -1) return false;
    
    // Нельзя вставать на пункт, занятый 2+ шашками соперника (можно только на пустую или с 1 шашкой)
    if (state.points[toPoint] > 1) return false;
    
    return true;
  }

  canBearOff(state: BoardState, player: number): boolean {
    if (player === 0) {
      // White: all checkers must be in home (points 1-6, indices 18-23)
      for (let i = 0; i < 18; i++) {
        if (state.points[i] > 0) return false;
      }
      return state.bar[0] === 0;
    } else {
      // Black: all checkers must be in home (points 19-24, indices 0-5)
      for (let i = 6; i < 24; i++) {
        if (state.points[i] < 0) return false;
      }
      return state.bar[1] === 0;
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
    // White enters in BLACK's home (opponent's home)
    // Black home is visually top right: Points 19-24 (indices 0-5)
    // White enters: die=1 → Point 24 → index 0, die=6 → Point 19 → index 5
    if (state.bar[0] > 0 && from === -1) {
      state.bar[0]--;
      const enterPointIndex = die - 1; // die=1 → 0 (Point 24), die=6 → 5 (Point 19)
      
      // Hit opponent's single checker (Blot)
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
      
      // Hit opponent's single checker (Blot)
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
    // Black enters in WHITE's home (opponent's home)
    // White home is visually bottom right: Points 1-6 (indices 18-23)
    // Black enters: die=1 → Point 1 → index 18, die=6 → Point 6 → index 23
    if (state.bar[1] > 0 && from === -1) {
      state.bar[1]--;
      const enterPointIndex = 17 + die; // die=1 → 18 (Point 1), die=6 → 23 (Point 6)
      
      // Hit opponent's single checker (Blot)
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
      
      // Hit opponent's single checker (Blot)
      if (state.points[to] === 1) {
        state.points[to] = -1;
        state.bar[0]++;
      } else {
        state.points[to]--;
      }
    }
  }

  isGameFinished(state: BoardState): boolean {
    return state.borneOff[0] === 5 || state.borneOff[1] === 5;
  }

  getWinner(state: BoardState): number | null {
    if (state.borneOff[0] === 5) return 0;
    if (state.borneOff[1] === 5) return 1;
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
      // Сохраняем текущую последовательность как возможную
      if (path.length > 0) {
        moves.push([...path]);
      }

      // Если нет оставшихся кубиков, мы закончили
      if (remainingDice.length === 0) {
        return;
      }

      // Пробуем использовать каждый доступный кубик
      const isDoubles = remainingDice.length >= 2 && remainingDice.every(d => d === remainingDice[0]);
      
      const triedDice = new Set<number>();
      
      for (let i = 0; i < remainingDice.length; i++) {
        const die = remainingDice[i];
        
        // Для обычных ходов пропускаем дубликаты
        if (!isDoubles && triedDice.has(die)) {
          continue;
        }
        triedDice.add(die);
        
        const possibleMoves = this.getPossibleMovesForDie(currentState, die);
        
        if (possibleMoves.length > 0) {
          const newRemainingDice = [...remainingDice];
          newRemainingDice.splice(i, 1);
          
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
        // White enters in BLACK's home (opponent's home)
        // Black home is visually top right: Points 19-24 (indices 0-5)
        // White enters: die=1 → Point 24 → index 0, die=6 → Point 19 → index 5
        const enterPointIndex = die - 1; // die=1 → 0 (Point 24), die=6 → 5 (Point 19)
        if (this.validateMove(state, -1, enterPointIndex, die)) {
          moves.push({ from: -1, to: enterPointIndex });
        }
      } else {
        // Regular moves from board
        for (let from = 0; from < this.BOARD_SIZE; from++) {
          if (state.points[from] > 0) {
            const to = this.calculateTargetPoint(0, from, die);
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
        // Black enters in WHITE's home (opponent's home)
        // White home is visually bottom right: Points 1-6 (indices 18-23)
        // Black enters: die=1 → Point 1 → index 18, die=6 → Point 6 → index 23
        const enterPointIndex = 17 + die; // die=1 → 18 (Point 1), die=6 → 23 (Point 6)
        if (this.validateMove(state, -1, enterPointIndex, die)) {
          moves.push({ from: -1, to: enterPointIndex });
        }
      } else {
        // Regular moves from board
        for (let from = 0; from < this.BOARD_SIZE; from++) {
          if (state.points[from] < 0) {
            const to = this.calculateTargetPoint(1, from, die);
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

