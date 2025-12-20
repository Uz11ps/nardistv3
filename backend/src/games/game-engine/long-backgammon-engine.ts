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
  // Массив points индексируется от 0 до 23, где:
  // - Индекс 0 = точка 24 (верхний ряд, справа)
  // - Индекс 11 = точка 13 (верхний ряд, слева)
  // - Индекс 12 = точка 12 (нижний ряд, слева)
  // - Индекс 23 = точка 1 (нижний ряд, справа)
  // Белые (положительные): 15 фишек на точке 13 (индекс 11)
  // Черные (отрицательные): 15 фишек на точке 1 (индекс 23)
  private readonly INITIAL_BOARD = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -15,
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
    // Белые начинают на точке 1 (индекс 23) и двигаются к точке 24 (индекс 0)
    // Движение: от большего индекса к меньшему (23 -> 0)
    if (state.bar[0] > 0) {
      if (from !== -1) return false;
      // Вход с бара: белые входят на точку (24 - die), что соответствует индексу (die - 1)
      const enterPoint = die - 1;
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE) return false;
      if (state.points[enterPoint] < 0) return false;
      return true;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] <= 0) return false;

    // Белые двигаются от большего индекса к меньшему: from - die
    const toPoint = from - die;
    if (toPoint < 0) {
      // Вынос возможен только если все фишки в доме (точки 19-24, индексы 18-23)
      if (this.canBearOff(state, 0)) {
        return true;
      }
      return false;
    }

    // Нельзя ходить на точку с фишками противника
    if (state.points[toPoint] < 0) return false;
    return true;
  }

  private validateMovePlayer2(state: LongBoardState, from: number, to: number, die: number): boolean {
    // Черные начинают на точке 13 (индекс 11) и двигаются к точке 1 (индекс 23), затем к точке 12 (индекс 12)
    // Движение: от меньшего индекса к большему (11 -> 23), затем циклически к меньшему (23 -> 12)
    if (state.bar[1] > 0) {
      if (from !== -1) return false;
      // Вход с бара: черные входят на точку die (индекс die - 1)
      const enterPoint = die - 1;
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE) return false;
      if (state.points[enterPoint] > 0) return false;
      return true;
    }

    if (from < 0 || from >= this.BOARD_SIZE) return false;
    if (state.points[from] >= 0) return false;

    // Черные двигаются циклически: от меньшего к большему, затем циклически
    // Если from + die >= 24, то это циклический переход через точку 1
    let toPoint = from + die;
    if (toPoint >= this.BOARD_SIZE) {
      // Вынос возможен только если все фишки в доме (точки 1-6, индексы 0-5)
      if (this.canBearOff(state, 1)) {
        return true;
      }
      // Циклический переход: (from + die) % 24
      toPoint = toPoint % this.BOARD_SIZE;
    }

    // Нельзя ходить на точку с фишками противника
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
    // Белые двигаются от точки 1 (индекс 23) к точке 24 (индекс 0)
    if (state.bar[0] > 0 && from === -1) {
      state.bar[0]--;
      // Вход с бара: белые входят на точку (24 - die), что соответствует индексу (die - 1)
      const enterPoint = die - 1;
      // В длинных нардах нельзя входить на точку с фишками противника
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE || state.points[enterPoint] < 0) {
        // Возвращаем фишку на бар если нельзя войти
        state.bar[0]++;
        return;
      }
      state.points[enterPoint]++;
      return;
    }

    if (to < 0 || to >= this.BOARD_SIZE) {
      // Вынос для белых
      if (state.points[from] > 0) {
        state.points[from]--;
        state.borneOff[0]++;
      }
      return;
    }

    // Обычный ход - в длинных нардах нельзя сбивать фишки противника
    if (state.points[from] > 0) {
      state.points[from]--;
    }
    
    // В длинных нардах можно ставить фишку только на пустую точку или на свою
    if (state.points[to] < 0) {
      // Нельзя ставить на точку противника
      if (state.points[from] >= 0) {
        state.points[from]++; // Возвращаем фишку
      }
      return;
    }
    
    state.points[to]++;
  }

  private applyMovePlayer2(state: LongBoardState, from: number, to: number, die: number): void {
    // Черные двигаются циклически: от точки 13 (индекс 11) к точке 1 (индекс 23), затем к точке 12 (индекс 12)
    if (state.bar[1] > 0 && from === -1) {
      state.bar[1]--;
      // Вход с бара: черные входят на точку die (индекс die - 1)
      const enterPoint = die - 1;
      // В длинных нардах нельзя входить на точку с фишками противника
      if (enterPoint < 0 || enterPoint >= this.BOARD_SIZE || state.points[enterPoint] > 0) {
        // Возвращаем фишку на бар если нельзя войти
        state.bar[1]++;
        return;
      }
      state.points[enterPoint]--;
      return;
    }

    if (to >= this.BOARD_SIZE || to === -1) {
      // Вынос для черных
      if (state.points[from] < 0) {
        state.points[from]++;
        state.borneOff[1]++;
      }
      return;
    }

    // Обычный ход - в длинных нардах нельзя сбивать фишки противника
    if (state.points[from] < 0) {
      state.points[from]++;
    }
    
    // В длинных нардах можно ставить фишку только на пустую точку или на свою
    if (state.points[to] > 0) {
      // Нельзя ставить на точку противника
      if (state.points[from] <= 0) {
        state.points[from]--; // Возвращаем фишку
      }
      return;
    }
    
    state.points[to]--;
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
   * Получить все возможные комбинации ходов для текущего игрока
   */
  getAllValidMoves(state: LongBoardState, dice: number[]): Array<Array<{ from: number; to: number; die: number }>> {
    if (dice.length === 0) return [];

    const moves: Array<Array<{ from: number; to: number; die: number }>> = [];

    // Генерируем все возможные комбинации ходов
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

      // Если есть фишки на баре, сначала нужно их ввести
      if (hasBarCheckers) {
        for (let i = 0; i < remainingDice.length; i++) {
          const die = remainingDice[i];
          const enterPoint = player === 0 ? die - 1 : die - 1;
          
          if (this.validateMove(currentState, -1, enterPoint, die)) {
            const newState = this.applyMove(currentState, -1, enterPoint, die);
            const newDice = [...remainingDice];
            newDice.splice(i, 1);
            generateMoves(newState, newDice, [...currentMoves, { from: -1, to: enterPoint, die }]);
          }
        }
        return;
      }

      // Ищем все возможные ходы с доски
      let foundAnyMove = false;
      for (let from = 0; from < this.BOARD_SIZE; from++) {
        const pointValue = currentState.points[from];
        const hasMyCheckers = player === 0 ? pointValue > 0 : pointValue < 0;
        
        if (!hasMyCheckers) continue;

        for (let i = 0; i < remainingDice.length; i++) {
          const die = remainingDice[i];
          
          // Вычисляем целевую точку
          let to: number;
          if (player === 0) {
            // Белые двигаются от большего индекса к меньшему
            to = from - die;
            if (to < 0 && this.canBearOff(currentState, 0)) {
              to = -1; // Вынос
            }
          } else {
            // Черные двигаются циклически
            to = from + die;
            if (to >= this.BOARD_SIZE) {
              if (this.canBearOff(currentState, 1)) {
                to = -1; // Вынос
              } else {
                to = to % this.BOARD_SIZE; // Циклический переход
              }
            }
          }

          if (this.validateMove(currentState, from, to, die)) {
            foundAnyMove = true;
            const newState = this.applyMove(currentState, from, to, die);
            const newDice = [...remainingDice];
            newDice.splice(i, 1);
            generateMoves(newState, newDice, [...currentMoves, { from, to, die }]);
          }
        }
      }

      // Если не найдено ни одного хода, сохраняем текущую последовательность
      if (!foundAnyMove && currentMoves.length > 0) {
        moves.push([...currentMoves]);
      }
    };

    generateMoves(state, dice, []);
    
    // Если нет ходов, возвращаем пустой массив с одним пустым массивом (пропуск хода)
    if (moves.length === 0) {
      return [[]];
    }

    // Возвращаем максимальные последовательности ходов
    const maxLength = Math.max(...moves.map((m) => m.length));
    return moves.filter((m) => m.length === maxLength);
  }
}

