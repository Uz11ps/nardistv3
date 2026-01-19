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
   * Both players move counter-clockwise around the board (visually), which corresponds to INCREASING indices in our array
   * White: starts at Index 0 (Point 24), moves: 0→1→...→23 (Point 24→23→...→1)
   * Black: starts at Index 12 (Point 12), moves: 12→13→...→23→0→...→11 (Point 12→11→...→1→24→...→13)
   * 
   * Movement is circular: index increases modulo 24
   */
  private calculateTargetPoint(player: number, from: number, die: number): number {
    // Both players move by INCREASING index (decreasing Point Number)
    // Movement is circular: 0->1->...->23->0
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
   * Exception (Правило Минспорта 20.3): On the FIRST move of the game, if a player rolls 3:3, 4:4, or 6:6, 
   * they can take TWO checkers from the head.
   */
  private checkHeadRule(state: LongBoardState, from: number, die: number, isFirstMoveOfGame: boolean = false): boolean {
    const player = state.currentPlayer;
    const headIndex = player === 0 ? this.WHITE_HEAD : this.BLACK_HEAD;
    
    // Если мы не ходим с головы, правило не применяется
    if (from !== headIndex) {
      return true;
    }
    
    const movedThisTurn = state.movesFromHead || 0;
    
    // Проверка исключения для первого хода
    if (isFirstMoveOfGame) {
      const originalDice = state.dice || [];
      // Проверяем, является ли это дублем 3, 4 или 6
      const isDoubles = originalDice.length >= 2 && originalDice.every(d => d === originalDice[0]);
      const isSpecificDoubles = isDoubles && (originalDice[0] === 3 || originalDice[0] === 4 || originalDice[0] === 6);
      
      if (isSpecificDoubles) {
        return movedThisTurn < 2;
      }
    }
    
    // Обычное правило: только 1 шашка за ход с головы
    // ВАЖНО: Это правило применяется независимо от того, используется ли один кубик или сумма кубиков
    // Если используется сумма кубиков (например, 4+6=10), это все равно считается одним ходом с головы
    return movedThisTurn === 0;
  }

  /**
   * Check Block Rule: Cannot create a block of 6 consecutive points if opponent has no checkers in home
   * According to Long Backgammon rules:
   * - You can build a "fence" of 6 consecutive points with your checkers
   * - BUT: This is only allowed if opponent has at least one checker in their home (not on head)
   * - Building a fence of 6 points when opponent has no checkers in home is forbidden
   */
  private checkBlockRule(state: LongBoardState, from: number, to: number): boolean {
    // Если to выходит за пределы доски (bear off) - правило не применяется
    if (to < 0 || to >= this.BOARD_SIZE) {
      return true;
    }
    
    const player = state.currentPlayer;
    
    // Быстрая проверка: есть ли у противника шашки в доме
    let opponentHasCheckerInHome = false;
    if (player === 0) {
      // Для белых проверяем дом черных (indices 6-11)
      for (let i = 6; i <= 11; i++) {
        if (state.points[i] < 0) {
          opponentHasCheckerInHome = true;
          break;
        }
      }
    } else {
      // Для черных проверяем дом белых (indices 18-23)
      for (let i = 18; i <= 23; i++) {
        if (state.points[i] > 0) {
          opponentHasCheckerInHome = true;
          break;
        }
      }
    }
    
    // Если противник имеет шашки в доме - правило не применяется
    if (opponentHasCheckerInHome) {
      return true;
    }
    
    // Противник не имеет шашек в доме - проверяем все блоки, которые могут быть затронуты ходом
    // Блок может быть затронут, если он включает 'from' или 'to', или находится рядом
    // Проверяем блоки, которые могут включать точки от (from-5) до (to+5)
    const checkPoints = new Set<number>();
    if (from >= 0 && from < this.BOARD_SIZE) {
      for (let i = -5; i <= 5; i++) {
        checkPoints.add((from + i + this.BOARD_SIZE) % this.BOARD_SIZE);
      }
    }
    for (let i = -5; i <= 5; i++) {
      checkPoints.add((to + i + this.BOARD_SIZE) % this.BOARD_SIZE);
    }
    
    // Для каждой точки, которая может быть началом блока, проверяем блок из 6 точек
    for (const potentialStart of checkPoints) {
      // Блок может начинаться максимум за 5 позиций до этой точки
      for (let offset = 0; offset < 6; offset++) {
        const blockStart = (potentialStart - offset + this.BOARD_SIZE) % this.BOARD_SIZE;
        
        let ourCountAfter = 0;
        let hasOpponentAfter = false;
        let blockIncludesFromOrTo = false;
        
        // Проверяем блок из 6 точек, начиная с blockStart
        for (let i = 0; i < 6; i++) {
          const idx = (blockStart + i) % this.BOARD_SIZE;
          let value = state.points[idx] || 0;
          
          // Отслеживаем, включает ли блок from или to
          if (idx === from || idx === to) {
            blockIncludesFromOrTo = true;
          }
          
          // Симуляция хода ПОСЛЕ
          if (idx === from && from >= 0 && from < this.BOARD_SIZE) {
            if (player === 0 && value > 0) value--;
            else if (player === 1 && value < 0) value++;
          } else if (idx === to) {
            if (player === 0) value++;
            else value--;
          }
          
          // Подсчитываем наши шашки в блоке
          if ((player === 0 && value > 0) || (player === 1 && value < 0)) {
            ourCountAfter++;
          }
          
          // Проверяем наличие противника в блоке
          if ((player === 0 && value < 0) || (player === 1 && value > 0)) {
            hasOpponentAfter = true;
          }
        }
        
        // Если блок включает from или to И после хода создается блок из 6 наших точек без противника
        if (blockIncludesFromOrTo && ourCountAfter === 6 && !hasOpponentAfter) {
          // Подсчитываем блок ДО хода
          // state.points уже содержит состояние ДО хода, так что просто считаем
          let ourCountBefore = 0;
          for (let i = 0; i < 6; i++) {
            const idx = (blockStart + i) % this.BOARD_SIZE;
            const value = state.points[idx] || 0;
            
            if ((player === 0 && value > 0) || (player === 1 && value < 0)) {
              ourCountBefore++;
            }
          }
          
          // Если блок создается заново (было меньше 6, стало 6) - запрещаем
          if (ourCountBefore < 6) {
            return false;
          }
        }
      }
    }
    
    return true;
  }

  validateMove(state: LongBoardState, from: number, to: number, die: number, isFirstMoveOfGame: boolean = false): boolean {
    if (state.currentPlayer === 0) {
      return this.validateMovePlayer1(state, from, to, die, isFirstMoveOfGame);
    } else {
      return this.validateMovePlayer2(state, from, to, die, isFirstMoveOfGame);
    }
  }

  /**
   * Validate move using sum of two dice (for combined moves)
   * This is used when player wants to combine two dice into one move
   */
  private validateMoveWithSum(state: LongBoardState, from: number, to: number, die1: number, die2: number, isFirstMoveOfGame: boolean = false): boolean {
    const sumDie = die1 + die2;
    // Use regular validation with the sum
    return this.validateMove(state, from, to, sumDie, isFirstMoveOfGame);
  }

  private validateMovePlayer1(state: LongBoardState, from: number, to: number, die: number, isFirstMoveOfGame: boolean = false): boolean {
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
    
    // Проверяем правило головы
    if (!this.checkHeadRule(state, from, die, isFirstMoveOfGame)) return false;
    
    // В длинных нард нет ограничения на количество шашек из одной точки (кроме головы)
    
    // Проверяем правило блокировки 6 точек - запрещаем создавать блок из 6 точек,
    // если у противника нет шашек в доме
    if (!this.checkBlockRule(state, from, to)) return false;
    
    return true;
  }

  private validateMovePlayer2(state: LongBoardState, from: number, to: number, die: number, isFirstMoveOfGame: boolean = false): boolean {
    if (state.bar[1] > 0) {
      if (from !== -1) return false;
      const enterPoint = (this.BLACK_HEAD + die) % this.BOARD_SIZE; // Player 2 moves same direction
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
        for (let i = 0; i < distanceTraveled; i++) {
          const checkIdx = (this.BLACK_HEAD + i) % this.BOARD_SIZE;
          if (state.points[checkIdx] < 0) return false;
        }
        return to === -1 || to < 0 || to >= this.BOARD_SIZE;
      }
      return false;
    }

    const calculatedTo = (from + die) % this.BOARD_SIZE;
    if (to !== calculatedTo) return false;
    if (state.points[to] > 0) return false;
    
    // Проверяем правило головы
    if (!this.checkHeadRule(state, from, die, isFirstMoveOfGame)) return false;
    
    // Проверяем правило блокировки 6 точек - запрещаем создавать блок из 6 точек,
    // если у противника нет шашек в доме
    if (!this.checkBlockRule(state, from, to)) return false;
    
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

  getAllValidMoves(state: LongBoardState, dice: number[], isFirstMoveOfGame: boolean = false, seed?: string): Array<Array<{ from: number; to: number; die: number }>> {
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
          // validateMove уже проверяет правило блока для каждого хода
          // Поэтому финальная проверка не нужна - если все ходы валидны, последовательность валидна
          moves.push([...currentMoves]);
        }
        return;
      }

    const player = currentState.currentPlayer;
    
    // Находим все возможные ходы с доски
    let foundAnyMove = false;
    
    const triedFromPoints = new Set<number>();
    for (let from = 0; from < this.BOARD_SIZE; from++) {
      const pointValue = currentState.points[from];
      const hasMyCheckers = player === 0 ? pointValue > 0 : pointValue < 0;
      
      if (!hasMyCheckers) continue;
      if (triedFromPoints.has(from)) continue;
      triedFromPoints.add(from);

      const triedDice = new Set<number>();
      for (let i = 0; i < remainingDice.length; i++) {
        const die = remainingDice[i];
        // Пропускаем одинаковые кубики для одного и того же состояния, 
        // чтобы избежать комбинаторного взрыва при дублях.
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

        if (this.validateMove(currentState, from, to, die, isFirstMoveOfGame)) {
          // validateMove уже проверяет правило блока через checkBlockRule
          foundAnyMove = true;
          const newState = this.applyMove(currentState, from, to, die);
          const newDice = [...remainingDice];
          newDice.splice(i, 1);
          generateMoves(newState, newDice, [...currentMoves, { from, to, die }]);
        }
      }
      
      // ВАЖНО: Для длинных нард также пробуем использовать сумму двух разных кубиков
      // Это позволяет использовать сумму кубиков (например, 4+6=10) для одного хода
      // Особенно важно для ходов с головы
      /* ОТКЛЮЧЕНО: Пользователь жалуется на некорректную работу сумм (перепрыгивание через блоки)
         В длинных нардах ходы должны быть строго поэтапными.
      if (remainingDice.length >= 2 && !isDoubles) {
        const triedSums = new Set<number>();
        for (let i = 0; i < remainingDice.length; i++) {
          for (let j = i + 1; j < remainingDice.length; j++) {
            const die1 = remainingDice[i];
            const die2 = remainingDice[j];
            const sumDie = die1 + die2;
            
            // Пропускаем если уже пробовали эту сумму
            if (triedSums.has(sumDie)) continue;
            triedSums.add(sumDie);
            
            // Пробуем ход с суммой кубиков
            const toPoint = this.calculateTargetPoint(player, from, sumDie);
            
            // Проверяем на вынос
            const distanceTraveled = player === 0 
              ? (from - this.WHITE_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE
              : (from - this.BLACK_HEAD + this.BOARD_SIZE) % this.BOARD_SIZE;
            
            const isBearingOffMove = (distanceTraveled + sumDie) >= this.BOARD_SIZE;
            const to = isBearingOffMove ? -1 : toPoint;
            
            // ВАЖНО: При использовании суммы кубиков для хода с головы правило головы должно разрешать это
            // Проверяем валидность хода с суммой
            if (this.validateMove(currentState, from, to, sumDie, isFirstMoveOfGame)) {
              foundAnyMove = true;
              // Применяем ход с суммой кубиков
              const newState = this.applyMove(currentState, from, to, sumDie);
              const newDice = [...remainingDice];
              // Удаляем оба использованных кубика
              const index1 = newDice.indexOf(die1);
              if (index1 !== -1) newDice.splice(index1, 1);
              const index2 = newDice.indexOf(die2);
              if (index2 !== -1) newDice.splice(index2, 1);
              generateMoves(newState, newDice, [...currentMoves, { from, to, die: sumDie }]);
            }
          }
        }
      }
      */
    }
      
      if (!foundAnyMove && currentMoves.length > 0) {
        moves.push([...currentMoves]);
      }
    };

    generateMoves(state, dice, []);
    
    // Если нет валидных ходов, возвращаем пустой массив (не [[]])
    if (moves.length === 0) return [];

    const maxLength = Math.max(...moves.map((m) => m.length));
    const bestMoves = moves.filter((m) => m.length === maxLength);
    
    // Перемешиваем порядок ходов для разнообразия (особенно важно для первого хода)
    // Используем детерминированный RNG на основе seed для provably fair
    if (bestMoves.length <= 1) {
      return bestMoves;
    }
    
    // Создаем seed для перемешивания на основе переданного seed + текущего состояния
    // Это гарантирует детерминированность при одинаковых условиях
    const shuffleSeed = seed 
      ? `${seed}-${JSON.stringify(state.points)}-${dice.join(',')}-${state.currentPlayer}`
      : `${JSON.stringify(state.points)}-${dice.join(',')}-${state.currentPlayer}-${Date.now()}`;
    
    const rng = this.createSeededRNG(shuffleSeed);
    const shuffledMoves = [...bestMoves];
    
    // Алгоритм Фишера-Йетса с детерминированным RNG
    for (let i = shuffledMoves.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledMoves[i], shuffledMoves[j]] = [shuffledMoves[j], shuffledMoves[i]];
    }
    
    return shuffledMoves;
  }
}
