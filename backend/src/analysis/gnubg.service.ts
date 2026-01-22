import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface GnubgPosition {
  points: number[]; // 24 points: positive = white, negative = black
  bar: [number, number]; // [white on bar, black on bar]
  borneOff: [number, number]; // [white borne off, black borne off]
  currentPlayer: number; // 0 = white, 1 = black
  dice?: number[];
  cubeValue?: number;
  cubeOwner?: number; // -1 = centered, 0 = white, 1 = black
}

export interface GnubgAnalysis {
  equity: number; // Equity (winning probability)
  winProbabilities: {
    win: number;
    winG: number; // Gammon win
    winBG: number; // Backgammon win
    loseG: number; // Gammon loss
    loseBG: number; // Backgammon loss
  };
  bestMove?: {
    moves: Array<{ from: number; to: number }>;
    equity: number;
  };
  alternatives?: Array<{
    moves: Array<{ from: number; to: number }>;
    equity: number;
    diff: number; // Difference from best move
  }>;
}

@Injectable()
export class GnubgService {
  private readonly logger = new Logger(GnubgService.name);
  private readonly gnubgPath: string;
  private readonly isAvailable: boolean;

  constructor() {
    // Проверяем доступность GNU Backgammon
    // Путь может быть: gnubg, /usr/bin/gnubg, /usr/local/bin/gnubg и т.д.
    this.gnubgPath = process.env.GNUBG_PATH || 'gnubg';
    this.isAvailable = false; // Будет проверено при первом использовании
    this.checkAvailability().catch(err => {
      this.logger.warn(`Не удалось проверить доступность GNU Backgammon: ${err.message}`);
    });
  }

  /**
   * Проверка доступности GNU Backgammon
   */
  private async checkAvailability(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`${this.gnubgPath} --version`);
      this.logger.log(`GNU Backgammon доступен: ${stdout.trim()}`);
      (this as any).isAvailable = true;
      return true;
    } catch (error: any) {
      this.logger.warn(`GNU Backgammon не найден: ${error.message}`);
      (this as any).isAvailable = false;
      return false;
    }
  }

  /**
   * Конвертация внутреннего формата позиции в формат GNU Backgammon
   * 
   * Наша система координат:
   * - Index 0 = Point 24 (Top Right) - White starting area
   * - Index 23 = Point 1 (Bottom Right) - Black starting area
   * - White moves: 0→1→...→23 (Point 24→23→...→1) - increasing index
   * - Black moves: 23→22→...→0 (Point 1→2→...→24) - decreasing index
   * 
   * GNU Backgammon система координат (стандартная нотация):
   * - Point 24 (Top Right) - White starting
   * - Point 1 (Bottom Right) - Black starting
   * - White home: Points 1-6 (Bottom Right)
   * - Black home: Points 19-24 (Top Right)
   * 
   * Конвертация: GNU Point = 24 - index
   */
  private convertToGnubgPosition(position: GnubgPosition): string {
    const points = position.points || new Array(24).fill(0);
    const bar = position.bar || [0, 0];
    const borneOff = position.borneOff || [0, 0];
    const currentPlayer = position.currentPlayer || 0;
    const cubeValue = position.cubeValue || 1;
    const cubeOwner = position.cubeOwner !== undefined ? position.cubeOwner : -1;
    
    // Конвертируем точки: наш index → GNU Point (24 - index)
    const positionParts: string[] = [];
    
    // Точки на доске
    for (let i = 0; i < 24; i++) {
      const p = points[i];
      if (p !== 0) {
        const gnubgPoint = 24 - i; // Конвертация индекса в GNU Point
        const count = Math.abs(p);
        const color = p > 0 ? 'w' : 'b'; // w = white, b = black
        positionParts.push(`${gnubgPoint}/${count}${color}`);
      }
    }
    
    // Бар (bar)
    if (bar[0] > 0) {
      positionParts.push(`bar/${bar[0]}w`);
    }
    if (bar[1] > 0) {
      positionParts.push(`bar/${bar[1]}b`);
    }
    
    // Вынесено (off)
    if (borneOff[0] > 0) {
      positionParts.push(`off/${borneOff[0]}w`);
    }
    if (borneOff[1] > 0) {
      positionParts.push(`off/${borneOff[1]}b`);
    }
    
    // Формируем команду position для GNU Backgammon
    // Формат: position [board] [turn] [cube owner] [cube value]
    const positionStr = positionParts.join(' ');
    const turn = currentPlayer === 0 ? '0' : '1'; // 0 = white, 1 = black
    const cubeOwnerStr = cubeOwner === -1 ? '-1' : (cubeOwner === 0 ? '0' : '1');
    
    return `${positionStr} ${turn} ${cubeOwnerStr} ${cubeValue}`;
  }

  /**
   * Анализ позиции через GNU Backgammon
   */
  async analyzePosition(
    position: GnubgPosition,
    dice?: number[],
  ): Promise<GnubgAnalysis | null> {
    // Проверяем доступность при первом использовании
    if (!this.isAvailable) {
      const available = await this.checkAvailability();
      if (!available) {
        this.logger.warn('GNU Backgammon недоступен для анализа');
        return null;
      }
    }

    try {
      // Конвертируем позицию в формат GNU Backgammon
      const positionStr = this.convertToGnubgPosition(position);
      
      // Настраиваем GNU Backgammon для правильного анализа
      // Устанавливаем пороги для категорий ошибок (в equity)
      const setupCommands = [
        'set analysis checker play on',
        'set analysis cube decisions on',
        'set analysis luck on',
        'set analysis move analysis on',
        'set analysis move analysis threshold 0.01', // Порог для анализа ходов
        'set analysis checker play threshold 0.01', // Порог для анализа игры шашками
        'set analysis cube decisions threshold 0.01', // Порог для решений по кубу
        'set analysis luck threshold 0.01', // Порог для анализа удачи
        'set analysis move analysis very bad threshold 0.10', // Very bad (грубая ошибка)
        'set analysis move analysis bad threshold 0.05', // Bad (ошибка)
        'set analysis move analysis doubtful threshold 0.02', // Doubtful (сомнительный)
        'set analysis checker play very bad threshold 0.10',
        'set analysis checker play bad threshold 0.05',
        'set analysis checker play doubtful threshold 0.02',
        'set bearoff type 2-sided', // Используем 2-sided bearoff базу для точности
        'set evaluation noise 0', // Без шума для точных расчетов
        'set rollout off', // Отключаем rollouts для скорости
      ];
      
      // Формируем команды для анализа
      // GNU Backgammon использует команду "set board" с Position ID или текстовый формат
      // Пробуем использовать текстовый формат через команду position
      const commands = [
        ...setupCommands,
        `set board ${positionStr}`, // Используем set board вместо position
        dice && dice.length > 0 ? `roll ${dice.join(' ')}` : '',
        'analyze move', // Анализ ходов
        'eval', // Оценка позиции
      ].filter(Boolean).join('\n');

      // Выполняем команды через gnubg -t (текстовый режим)
      // Используем -t для текстового режима и --no-pipe для избежания проблем с pipe
      const { stdout, stderr } = await execAsync(
        `echo "${commands}" | ${this.gnubgPath} -t --no-pipe`,
        { 
          timeout: 15000, // Таймаут 15 секунд
          maxBuffer: 1024 * 1024 * 10, // 10MB буфер для вывода
        }
      );

      // Логируем вывод для отладки
      if (stderr) {
        this.logger.debug(`GNU Backgammon stderr: ${stderr}`);
      }
      this.logger.debug(`GNU Backgammon stdout: ${stdout.substring(0, 500)}`);

      // Парсим результат
      return this.parseAnalysis(stdout);
    } catch (error: any) {
      this.logger.error(`Ошибка анализа GNU Backgammon: ${error.message}`, error.stack);
      if (error.stdout) {
        this.logger.debug(`GNU Backgammon stdout: ${error.stdout.substring(0, 500)}`);
      }
      if (error.stderr) {
        this.logger.debug(`GNU Backgammon stderr: ${error.stderr.substring(0, 500)}`);
      }
      return null;
    }
  }

  /**
   * Парсинг результата анализа из вывода GNU Backgammon
   * 
   * GNU Backgammon выводит данные в формате:
   * Equity: 0.123
   * Win: 45.2% G: 12.3% BG: 1.2%
   * Lose: 54.8% G: 10.1% BG: 0.5%
   * 
   * Или более детально:
   * Player 0 (White):
   *   Win: 45.2%
   *   Win gammon: 12.3%
   *   Win backgammon: 1.2%
   *   Lose: 54.8%
   *   Lose gammon: 10.1%
   *   Lose backgammon: 0.5%
   */
  private parseAnalysis(output: string): GnubgAnalysis | null {
    try {
      // Парсим equity
      const equityMatch = output.match(/Equity[:\s]+([-\d.]+)/i);
      const equity = equityMatch ? parseFloat(equityMatch[1]) : 0;
      
      // Парсим вероятности выигрыша
      // Ищем паттерны типа "Win: 45.2%" или "Win 45.2%"
      const winMatch = output.match(/Win[:\s]+([\d.]+)\s*%/i);
      const winGammonMatch = output.match(/Win\s+gammon[:\s]+([\d.]+)\s*%/i) || 
                              output.match(/G[:\s]+([\d.]+)\s*%/i);
      const winBackgammonMatch = output.match(/Win\s+backgammon[:\s]+([\d.]+)\s*%/i) ||
                                  output.match(/BG[:\s]+([\d.]+)\s*%/i);
      
      // Парсим вероятности проигрыша
      const loseMatch = output.match(/Lose[:\s]+([\d.]+)\s*%/i);
      const loseGammonMatch = output.match(/Lose\s+gammon[:\s]+([\d.]+)\s*%/i);
      const loseBackgammonMatch = output.match(/Lose\s+backgammon[:\s]+([\d.]+)\s*%/i);
      
      const win = winMatch ? parseFloat(winMatch[1]) / 100 : 0.5;
      const winG = winGammonMatch ? parseFloat(winGammonMatch[1]) / 100 : 0;
      const winBG = winBackgammonMatch ? parseFloat(winBackgammonMatch[1]) / 100 : 0;
      const lose = loseMatch ? parseFloat(loseMatch[1]) / 100 : (1 - win);
      const loseG = loseGammonMatch ? parseFloat(loseGammonMatch[1]) / 100 : 0;
      const loseBG = loseBackgammonMatch ? parseFloat(loseBackgammonMatch[1]) / 100 : 0;
      
      return {
        equity,
        winProbabilities: {
          win,
          winG,
          winBG,
          loseG,
          loseBG,
        },
      };
    } catch (error: any) {
      this.logger.error(`Ошибка парсинга анализа: ${error.message}`);
      return null;
    }
  }

  /**
   * Анализ хода: сравнение сделанного хода с оптимальным
   */
  async analyzeMove(
    positionBefore: GnubgPosition,
    positionAfter: GnubgPosition,
    dice: number[],
    madeMove: Array<{ from: number; to: number }>,
  ): Promise<{
    equityBefore: number;
    equityAfter: number;
    scoreChange: number;
    bestMove?: Array<{ from: number; to: number }>;
    alternatives?: Array<{
      moves: Array<{ from: number; to: number }>;
      equity: number;
      diff: number;
    }>;
    moveQuality?: 'excellent' | 'good' | 'neutral' | 'doubtful' | 'bad' | 'very bad';
  } | null> {
    // Проверяем доступность при первом использовании
    if (!this.isAvailable) {
      const available = await this.checkAvailability();
      if (!available) {
        return null;
      }
    }

    try {
      const positionStr = this.convertToGnubgPosition(positionBefore);
      
      // Настраиваем GNU Backgammon
      const setupCommands = [
        'set analysis checker play on',
        'set analysis move analysis on',
        'set analysis move analysis threshold 0.01',
        'set analysis move analysis very bad threshold 0.10',
        'set analysis move analysis bad threshold 0.05',
        'set analysis move analysis doubtful threshold 0.02',
        'set bearoff type 2-sided',
        'set evaluation noise 0',
        'set rollout off',
      ];
      
      // Конвертируем наш ход в формат GNU Backgammon
      const madeMoveStr = this.convertMoveToGnubg(madeMove);
      
      // Формируем команды для анализа хода
      const commands = [
        ...setupCommands,
        `set board ${positionStr}`,
        `roll ${dice.join(' ')}`,
        'analyze move', // Получаем анализ всех возможных ходов
        'hint', // Получаем подсказку по лучшему ходу
        'eval', // Оценка позиции
      ].join('\n');

      const { stdout, stderr } = await execAsync(
        `echo "${commands}" | ${this.gnubgPath} -t --no-pipe`,
        { 
          timeout: 20000,
          maxBuffer: 1024 * 1024 * 10,
        }
      );

      // Парсим анализ позиции до хода
      const analysisBefore = this.parseAnalysis(stdout);
      if (!analysisBefore) return null;

      // Анализируем позицию после хода
      const analysisAfter = await this.analyzePosition(positionAfter);
      if (!analysisAfter) return null;

      // Вычисляем изменение equity
      const scoreChange = analysisAfter.equity - analysisBefore.equity;

      // Парсим лучший ход и альтернативы из вывода
      const moveAnalysis = this.parseMoveAnalysis(stdout, madeMoveStr);

      // Определяем качество хода на основе изменения equity
      let moveQuality: 'excellent' | 'good' | 'neutral' | 'doubtful' | 'bad' | 'very bad' = 'neutral';
      if (scoreChange >= 0.10) {
        moveQuality = 'very bad';
      } else if (scoreChange >= 0.05) {
        moveQuality = 'bad';
      } else if (scoreChange >= 0.02) {
        moveQuality = 'doubtful';
      } else if (scoreChange <= -0.02) {
        moveQuality = 'excellent';
      } else if (scoreChange <= -0.01) {
        moveQuality = 'good';
      }

      return {
        equityBefore: analysisBefore.equity,
        equityAfter: analysisAfter.equity,
        scoreChange,
        bestMove: moveAnalysis.bestMove,
        alternatives: moveAnalysis.alternatives,
        moveQuality,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка анализа хода: ${error.message}`);
      return null;
    }
  }

  /**
   * Конвертация хода из нашего формата в формат GNU Backgammon
   * Наш формат: { from: index, to: index }
   * GNU формат: "X/Y" где X и Y - точки 1-24, или "bar/X", "X/off"
   */
  private convertMoveToGnubg(moves: Array<{ from: number; to: number }>): string {
    return moves.map(m => {
      let fromStr: string;
      let toStr: string;
      
      // Конвертируем from
      if (m.from === -1) {
        fromStr = 'bar';
      } else if (m.from >= 24) {
        fromStr = 'off';
      } else {
        fromStr = (24 - m.from).toString(); // Конвертируем индекс в точку
      }
      
      // Конвертируем to
      if (m.to === -1 || m.to >= 24) {
        toStr = 'off';
      } else {
        toStr = (24 - m.to).toString(); // Конвертируем индекс в точку
      }
      
      return `${fromStr}/${toStr}`;
    }).join(' ');
  }

  /**
   * Парсинг анализа ходов из вывода GNU Backgammon
   */
  private parseMoveAnalysis(output: string, madeMove?: string): {
    bestMove?: Array<{ from: number; to: number }>;
    alternatives?: Array<{
      moves: Array<{ from: number; to: number }>;
      equity: number;
      diff: number;
    }>;
  } {
    // GNU Backgammon выводит анализ ходов в формате:
    // Move 1: X/Y Z/W (equity: 0.123)
    // Move 2: A/B C/D (equity: 0.120, diff: -0.003)
    // ...
    
    const moves: Array<{
      moves: Array<{ from: number; to: number }>;
      equity: number;
      diff: number;
    }> = [];
    
    // Парсим строки с ходами
    const moveLines = output.split('\n').filter(line => 
      line.match(/Move\s+\d+:/i) || line.match(/^\d+\.\s+[^\s]+\/[^\s]+/i)
    );
    
    for (const line of moveLines) {
      // Парсим формат "Move 1: bar/22 17/9 (equity: 0.123)"
      const moveMatch = line.match(/(?:Move\s+\d+:\s+)?([^\s(]+(?:\s+[^\s(]+)*)\s*\([^)]*equity[:\s]+([-\d.]+)[^)]*\)/i);
      if (moveMatch) {
        const moveStr = moveMatch[1].trim();
        const equity = parseFloat(moveMatch[2]);
        
        // Конвертируем строку хода в наш формат
        const convertedMoves = this.parseGnubgMove(moveStr);
        if (convertedMoves.length > 0) {
          moves.push({
            moves: convertedMoves,
            equity,
            diff: moves.length > 0 ? equity - moves[0].equity : 0,
          });
        }
      }
    }
    
    // Сортируем по equity (лучший первый)
    moves.sort((a, b) => b.equity - a.equity);
    
    return {
      bestMove: moves.length > 0 ? moves[0].moves : undefined,
      alternatives: moves.slice(1).map(m => ({
        moves: m.moves,
        equity: m.equity,
        diff: m.diff,
      })),
    };
  }

  /**
   * Парсинг хода из формата GNU Backgammon в наш формат
   */
  private parseGnubgMove(moveStr: string): Array<{ from: number; to: number }> {
    const moves: Array<{ from: number; to: number }> = [];
    const parts = moveStr.trim().split(/\s+/);
    
    for (const part of parts) {
      const [fromStr, toStr] = part.split('/');
      if (!fromStr || !toStr) continue;
      
      let from: number;
      let to: number;
      
      // Конвертируем from
      if (fromStr === 'bar') {
        from = -1;
      } else if (fromStr === 'off') {
        from = 24;
      } else {
        const point = parseInt(fromStr);
        from = 24 - point; // Конвертируем точку в индекс
      }
      
      // Конвертируем to
      if (toStr === 'off') {
        to = 24;
      } else {
        const point = parseInt(toStr);
        to = 24 - point; // Конвертируем точку в индекс
      }
      
      moves.push({ from, to });
    }
    
    return moves;
  }

  /**
   * Конвертация из формата нашей игры (GameMove) в формат GnubgPosition
   */
  convertGameStateToGnubgPosition(gameState: any): GnubgPosition {
    const points = gameState.points || new Array(24).fill(0);
    const bar = gameState.bar || [0, 0];
    const borneOff = gameState.borneOff || gameState.bearOff || [0, 0];
    const currentPlayer = gameState.currentPlayer || 0;
    const cubeValue = gameState.cubeValue || 1;
    const cubeOwner = gameState.cubeOwner !== undefined ? gameState.cubeOwner : -1;
    
    // Нормализуем bar и borneOff если они в формате объектов
    let normalizedBar: [number, number] = [0, 0];
    if (Array.isArray(bar)) {
      normalizedBar = [bar[0] || 0, bar[1] || 0];
    } else if (bar && typeof bar === 'object') {
      normalizedBar = [bar.white || bar[0] || 0, bar.black || bar[1] || 0];
    }
    
    let normalizedBorneOff: [number, number] = [0, 0];
    if (Array.isArray(borneOff)) {
      normalizedBorneOff = [borneOff[0] || 0, borneOff[1] || 0];
    } else if (borneOff && typeof borneOff === 'object') {
      normalizedBorneOff = [borneOff.white || borneOff[0] || 0, borneOff.black || borneOff[1] || 0];
    }
    
    return {
      points,
      bar: normalizedBar,
      borneOff: normalizedBorneOff,
      currentPlayer,
      cubeValue,
      cubeOwner,
    };
  }

  /**
   * Проверка доступности сервиса
   */
  isGnubgAvailable(): boolean {
    return this.isAvailable;
  }
}

