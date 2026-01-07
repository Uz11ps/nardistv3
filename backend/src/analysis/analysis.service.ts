import { Injectable, Inject, forwardRef, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { BackgammonEngine } from '../games/game-engine/backgammon-engine';
import { LongBackgammonEngine } from '../games/game-engine/long-backgammon-engine';

interface WinProbabilities {
  win: number;
  winG: number;
  winBG: number;
  loseG: number;
  loseBG: number;
}

interface MoveAnalysis {
  moveNumber: number;
  move: GameMove;
  isError: boolean;
  errorType?: 'blunder' | 'mistake' | 'inaccuracy';
  errorDescription?: string;
  isBestMove?: boolean; // Флаг что это лучший ход (максимальный equity)
  bestMove?: Array<{ from: number; to: number; die: number }>;
  scoreChange: number;
  equity?: number;
  winProbabilities?: WinProbabilities;
  alternatives?: Array<{
    moves: Array<{ from: number; to: number; die: number }>;
    equity: number;
    isCurrent?: boolean;
    diff?: number;
  }>;
}

export interface GameAnalysis {
  gameId: string;
  totalMoves: number;
  allMoves: MoveAnalysis[]; // Все ходы
  errors: MoveAnalysis[]; // Только ошибки
  mistakes: number;
  blunders: number;
  inaccuracies: number;
  recommendations: string[];
  gameResult?: 'win' | 'loss';
}

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameMove)
    private movesRepository: Repository<GameMove>,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
    private backgammonEngine: BackgammonEngine,
    private longBackgammonEngine: LongBackgammonEngine,
  ) {}

  /**
   * Анализ игры для премиум пользователей
   * Находит ошибки в ходах и дает рекомендации
   */
  async analyzeGame(userId: string, gameId: string): Promise<GameAnalysis> {
    // Проверяем доступ пользователя к игре
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['player1', 'player2'],
    });

    if (!game) {
      throw new Error('Игра не найдена');
    }

    if (game.player1Id !== userId && game.player2Id !== userId) {
      throw new ForbiddenException('Нет доступа к этой игре');
    }

    // Проверяем премиум подписку (отключено для теста по запросу пользователя)
    /*
    const hasPremium = await this.subscriptionService.hasActiveSubscription(userId);
    if (!hasPremium) {
      throw new ForbiddenException('Анализ игр доступен только для премиум пользователей');
    }
    */

    // Загружаем все ходы
    const moves = await this.movesRepository.find({
      where: { gameId },
      order: { moveNumber: 'ASC' },
      relations: ['player'],
    });

    const engine = game.mode === 'short' ? this.backgammonEngine : this.longBackgammonEngine;
    const errors: MoveAnalysis[] = [];
    const allMovesAnalysis: MoveAnalysis[] = [];

    // Анализируем каждый ход
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isUserMove = move.playerId === userId;
      
      // Даже если это не ход пользователя, мы можем захотеть его показать в общем списке, 
      // но анализ (ошибки) делаем только для пользователя.
      
      const gameStateBefore = move.gameStateBefore;
      const gameStateAfter = move.gameStateAfter;

      // Находим все возможные ходы для этой позиции, чтобы показать альтернативы
      const allPossibleMovesSequences = engine.getAllValidMoves(gameStateBefore, move.dice);
      const evaluatedAlternatives: Array<{
        moves: Array<{ from: number; to: number; die: number }>;
        equity: number;
        isCurrent?: boolean;
        diff?: number;
      }> = allPossibleMovesSequences.map(mSeq => {
        let testState = { ...gameStateBefore };
        for (const m of mSeq) {
          testState = engine.applyMove(testState, m.from, m.to, m.die);
        }
        const equity = this.evaluatePosition(engine, testState, userId === game.player1Id ? 0 : 1, game.mode);
        return {
          moves: mSeq,
          equity: equity,
        };
      }).sort((a, b) => b.equity - a.equity).slice(0, 6);

      // Оцениваем позицию до и после хода
      const equityBefore = this.evaluatePosition(engine, gameStateBefore, userId === game.player1Id ? 0 : 1, game.mode);
      const equityAfter = this.evaluatePosition(engine, gameStateAfter, userId === game.player1Id ? 0 : 1, game.mode);
      
      const equity = equityAfter;
      const bestAlternative = evaluatedAlternatives[0];
      const bestEquity = bestAlternative ? bestAlternative.equity : equityBefore;
      
      // Добавляем текущий ход в альтернативы если его там нет (для сравнения)
      const currentMoveInAlts = evaluatedAlternatives.find(alt => 
        JSON.stringify(alt.moves) === JSON.stringify(move.moves)
      );
      
      if (!currentMoveInAlts) {
        evaluatedAlternatives.push({
          moves: move.moves as any,
          equity: equity,
          isCurrent: true
        });
        evaluatedAlternatives.sort((a, b) => b.equity - a.equity);
      } else {
        currentMoveInAlts.isCurrent = true;
      }

      // Расчитываем разницу (diff) для каждой альтернативы относительно лучшей
      const maxEquity = evaluatedAlternatives[0]?.equity || 0;
      evaluatedAlternatives.forEach(alt => {
        alt.diff = alt.equity - maxEquity;
      });

      const missedEquity = bestEquity - equity;

      // Определяем, является ли текущий ход лучшим (diff === 0 или очень близок, погрешность < 0.001)
      const currentMoveDiff = evaluatedAlternatives.find(alt => alt.isCurrent)?.diff || 999;
      const isBestMove = Math.abs(currentMoveDiff) < 0.001;

      // Рассчитываем вероятности выигрыша на основе equity
      // Equity в диапазоне примерно -2 до +2:
      // -2 = бэкгаммон поражение, -1.5 = гаммон поражение, -1 = обычное поражение
      // 0 = равная позиция
      // 1 = обычная победа, 1.5 = гаммон победа, 2 = бэкгаммон победа
      const winProbabilities = this.calculateWinProbabilities(equity);

      // Определяем тип ошибки на основе упущенной equity
      // Пороги для ошибок (в equity):
      // Blunder: > 0.10 (упущено больше 0.10 equity)
      // Mistake: > 0.05 (упущено больше 0.05 equity)
      // Inaccuracy: > 0.02 (упущено больше 0.02 equity)
      let isError = false;
      let errorType: 'blunder' | 'mistake' | 'inaccuracy' | undefined;
      let errorDescription: string | undefined;

      if (missedEquity > 0.10) {
        isError = true;
        errorType = 'blunder';
        errorDescription = `Грубая ошибка (-${missedEquity.toFixed(3)} equity)`;
      } else if (missedEquity > 0.05) {
        isError = true;
        errorType = 'mistake';
        errorDescription = `Ошибка (-${missedEquity.toFixed(3)} equity)`;
      } else if (missedEquity > 0.02) {
        isError = true;
        errorType = 'inaccuracy';
        errorDescription = `Неточность (-${missedEquity.toFixed(3)} equity)`;
      }

      const analysis: MoveAnalysis = {
        moveNumber: move.moveNumber,
        move,
        isError,
        errorType,
        errorDescription,
        isBestMove,
        bestMove: bestAlternative?.moves,
        scoreChange: -missedEquity * 100, // Конвертируем в старую шкалу для обратной совместимости
        equity,
        winProbabilities,
        alternatives: evaluatedAlternatives,
      };

      allMovesAnalysis.push(analysis);
      if (isError && isUserMove) {
        errors.push(analysis);
      }
    }

    // Генерируем рекомендации
    const recommendations = this.generateRecommendations(errors, game.mode);

    return {
      gameId,
      totalMoves: moves.length,
      allMoves: allMovesAnalysis,
      errors,
      mistakes: errors.filter((e) => e.errorType === 'mistake').length,
      blunders: errors.filter((e) => e.errorType === 'blunder').length,
      inaccuracies: errors.filter((e) => e.errorType === 'inaccuracy').length,
      recommendations,
      gameResult: game.winnerId === userId ? 'win' : 'loss',
    };
  }

  /**
   * Расчет пип-каунта (pip count) - расстояния всех шашек до финиша
   */
  private calculatePipCount(gameState: any, playerIndex: number, mode: string): number {
    const points = gameState.points || [];
    const bar = Array.isArray(gameState.bar) ? gameState.bar : [gameState.bar?.white || 0, gameState.bar?.black || 0];
    
    let pipCount = 0;
    const isLong = mode === 'long' || mode === 'LONG';

    if (playerIndex === 0) {
      // Белые игроки
      points.forEach((val, idx) => {
        if (val > 0) {
          if (isLong) {
            // В длинных: белые идут от 0 (точка 24) к 23 (точка 1)
            // Расстояние = 24 - idx
            pipCount += val * (24 - idx);
          } else {
            // В коротких: белые идут от точки 24 к дому (точки 19-24, индексы 18-23)
            // Дом для белых: точки 1-6 (индексы 23, 22, 21, 20, 19, 18)
            // Расстояние от точки idx до дома
            if (idx >= 18) {
              // Уже в доме, расстояние = 0 (но считаем как есть, т.к. нужно вывести)
              pipCount += val * (24 - idx);
            } else {
              // Вне дома, расстояние до дома + расстояние в доме
              const distanceToHome = 24 - idx;
              pipCount += val * distanceToHome;
            }
          }
        }
      });
      
      // Шашки на баре добавляют максимальное расстояние (нужно войти на точку 24, потом дойти до дома)
      pipCount += bar[0] * 25; // 24 для входа + 1 для пути в доме
      
    } else {
      // Черные игроки
      points.forEach((val, idx) => {
        if (val < 0) {
          const checkerCount = Math.abs(val);
          if (isLong) {
            // В длинных: черные идут от 12 (точка 12) к 0 (точка 24), затем к 23 (точка 1)
            // Голова черных на точке 12 (индекс 12)
            if (idx <= 12) {
              // От головы к точке 24
              const dist = 12 - idx;
              pipCount += checkerCount * dist;
            } else {
              // От точки 24 к точке 1
              const dist = (24 - idx) + 12;
              pipCount += checkerCount * dist;
            }
          } else {
            // В коротких: черные идут от точки 1 к дому (точки 1-6, индексы 0-5)
            // Дом для черных: точки 1-6 (индексы 0, 1, 2, 3, 4, 5)
            if (idx < 6) {
              // Уже в доме
              pipCount += checkerCount * (idx + 1);
            } else {
              // Вне дома, расстояние до дома
              const distanceToHome = idx + 1;
              pipCount += checkerCount * distanceToHome;
            }
          }
        }
      });
      
      // Шашки на баре (для черных нужно войти на точку 1, потом дойти до дома)
      pipCount += bar[1] * 7; // 6 для входа на точку 1 + 1 для пути в доме
    }

    return pipCount;
  }

  /**
   * Профессиональная оценка позиции на основе пип-каунтов, контроля доски и других факторов
   * Возвращает equity в диапазоне примерно от -2 до +2 (где 1 = победа в обычную игру)
   */
  private evaluatePosition(engine: any, gameState: any, playerIndex: number, mode: string = 'long'): number {
    const points = gameState.points || [];
    const bar = Array.isArray(gameState.bar) ? gameState.bar : [gameState.bar?.white || 0, gameState.bar?.black || 0];
    const borneOff = Array.isArray(gameState.borneOff) 
      ? gameState.borneOff 
      : [gameState.borneOff?.white || 0, gameState.borneOff?.black || 0];
    
    const opponentIndex = 1 - playerIndex;
    const isLong = mode === 'long' || mode === 'LONG';

    // 1. Расчет пип-каунтов (основной фактор)
    const myPipCount = this.calculatePipCount(gameState, playerIndex, mode);
    const opponentPipCount = this.calculatePipCount(gameState, opponentIndex, mode);
    const pipDiff = opponentPipCount - myPipCount;
    
    // Конвертируем разницу пип-каунтов в equity (примерно 0.01 equity за каждый пип)
    let equity = pipDiff * 0.01;

    // 2. Проверка на завершение игры
    const myBorneOff = borneOff[playerIndex];
    const opponentBorneOff = borneOff[opponentIndex];
    
    if (myBorneOff >= 15) {
      // Игра закончена - победа
      if (opponentBorneOff === 0) {
        return 2.0; // Бэкгаммон (оппонент ничего не вывел)
      } else if (opponentBorneOff < 15) {
        return 1.5; // Гаммон (оппонент не закончил)
      } else {
        return 1.0; // Обычная победа
      }
    }
    
    if (opponentBorneOff >= 15) {
      // Поражение
      if (myBorneOff === 0) {
        return -2.0; // Бэкгаммон
      } else if (myBorneOff < 15) {
        return -1.5; // Гаммон
      } else {
        return -1.0; // Обычное поражение
      }
    }

    // 3. Шашки на баре (большой штраф)
    const myBarCount = bar[playerIndex];
    const opponentBarCount = bar[opponentIndex];
    equity -= myBarCount * 0.15;
    equity += opponentBarCount * 0.15;

    // 4. Контроль доски (прима, блокировки)
    let myPoints = 0; // Количество собственных точек (2+ шашек)
    let opponentPoints = 0;
    let myPrimeLength = 0; // Длина примы (последовательных точек)
    let maxPrimeLength = 0;
    let currentPrimeLength = 0;

    if (playerIndex === 0) {
      for (let i = 0; i < 24; i++) {
        if (points[i] >= 2) {
          myPoints++;
          currentPrimeLength++;
          maxPrimeLength = Math.max(maxPrimeLength, currentPrimeLength);
        } else {
          currentPrimeLength = 0;
        }
      }
      myPrimeLength = maxPrimeLength;
      
      maxPrimeLength = 0;
      currentPrimeLength = 0;
      for (let i = 0; i < 24; i++) {
        if (points[i] <= -2) {
          opponentPoints++;
          currentPrimeLength++;
          maxPrimeLength = Math.max(maxPrimeLength, currentPrimeLength);
        } else {
          currentPrimeLength = 0;
        }
      }
    } else {
      for (let i = 0; i < 24; i++) {
        if (points[i] <= -2) {
          myPoints++;
          currentPrimeLength++;
          maxPrimeLength = Math.max(maxPrimeLength, currentPrimeLength);
        } else {
          currentPrimeLength = 0;
        }
      }
      myPrimeLength = maxPrimeLength;
      
      maxPrimeLength = 0;
      currentPrimeLength = 0;
      for (let i = 0; i < 24; i++) {
        if (points[i] >= 2) {
          opponentPoints++;
          currentPrimeLength++;
          maxPrimeLength = Math.max(maxPrimeLength, currentPrimeLength);
        } else {
          currentPrimeLength = 0;
        }
      }
    }

    // Бонус за контроль доски
    equity += (myPoints - opponentPoints) * 0.02;
    
    // Бонус за приму (блокировка оппонента)
    if (myPrimeLength >= 4) {
      equity += (myPrimeLength - 3) * 0.05; // Прима из 4+ точек очень ценна
    }

    // 5. Близость к дому (чем ближе к выводу, тем лучше)
    const homeBoardStart = playerIndex === 0 ? 18 : 0;
    const homeBoardEnd = playerIndex === 0 ? 23 : 5;
    let myHomeCheckers = 0;
    let opponentHomeCheckers = 0;

    for (let i = homeBoardStart; i <= homeBoardEnd; i++) {
      if (playerIndex === 0 && points[i] > 0) {
        myHomeCheckers += points[i];
      } else if (playerIndex === 1 && points[i] < 0) {
        myHomeCheckers += Math.abs(points[i]);
      }
      
      if (opponentIndex === 0 && points[i] > 0) {
        opponentHomeCheckers += points[i];
      } else if (opponentIndex === 1 && points[i] < 0) {
        opponentHomeCheckers += Math.abs(points[i]);
      }
    }

    equity += (myHomeCheckers - opponentHomeCheckers) * 0.01;

    // 6. Одиночные шашки (блоты) - риск
    let myBlots = 0;
    let opponentBlots = 0;

    for (let i = 0; i < 24; i++) {
      if (playerIndex === 0 && points[i] === 1) {
        myBlots++;
      } else if (playerIndex === 1 && points[i] === -1) {
        myBlots++;
      }
      
      if (opponentIndex === 0 && points[i] === 1) {
        opponentBlots++;
      } else if (opponentIndex === 1 && points[i] === -1) {
        opponentBlots++;
      }
    }

    equity -= (myBlots - opponentBlots) * 0.03;

    return equity;
  }

  /**
   * Генерация рекомендаций на основе ошибок
   */
  private generateRecommendations(errors: MoveAnalysis[], mode: string): string[] {
    const recommendations: string[] = [];

    const blunderCount = errors.filter((e) => e.errorType === 'blunder').length;
    const mistakeCount = errors.filter((e) => e.errorType === 'mistake').length;

    if (blunderCount > 3) {
      recommendations.push('Вы часто делаете серьезные ошибки. Рекомендуем изучить базовые стратегии нардов.');
    }

    if (mistakeCount > 5) {
      recommendations.push('Много ошибок в оценке позиций. Обратите внимание на расстановку шашек.');
    }

    const barErrors = errors.filter((e) => {
      return e.move.moves?.some((m: any) => {
        // Проверяем, были ли шашки на баре
        const beforeBar = e.move.gameStateBefore?.bar;
        return beforeBar && (beforeBar.white > 0 || beforeBar.black > 0);
      });
    });

    if (barErrors.length > 0) {
      recommendations.push('Проблемы с выведением шашек с бара. Изучите правила выброса.');
    }

    const bearOffErrors = errors.filter((e) => {
      return e.move.moves?.some((m: any) => {
        // Проверяем, были ли шашки в процессе вывода
        const after = e.move.gameStateAfter;
        const bearOff = after?.bearOff;
        return bearOff && (bearOff.white > 0 || bearOff.black > 0);
      });
    });

    if (bearOffErrors.length > 0 && bearOffErrors.length < errors.length / 2) {
      recommendations.push('Работа над техникой вывода шашек улучшит вашу игру.');
    }

    if (errors.length === 0) {
      recommendations.push('Отличная игра! Вы играли почти без ошибок.');
    }

    return recommendations;
  }

  /**
   * Расчет вероятностей выигрыша на основе equity
   * Использует более точную формулу, приближенную к профессиональным анализаторам
   */
  private calculateWinProbabilities(equity: number): WinProbabilities {
    // Equity в диапазоне примерно -2 до +2
    // Конвертируем в вероятность выигрыша
    
    // Используем логистическую функцию для конвертации equity в вероятность
    // P(win) = 1 / (1 + exp(-k * equity))
    // где k - коэффициент (обычно около 3-4 для нардов)
    const k = 3.5;
    const winProb = 1 / (1 + Math.exp(-k * equity));
    
    // Корректируем для крайних случаев
    let win = Math.min(0.999, Math.max(0.001, winProb));
    
    // Для гаммонов и бэкгаммонов используем эмпирические формулы
    // Вероятность гаммона обычно выше при большом преимуществе в пип-каунтах
    let winG = 0;
    let winBG = 0;
    
    if (equity > 0.3) {
      // При хорошем преимуществе есть шанс на гаммон
      winG = Math.min(0.3, (equity - 0.3) * 0.5);
    }
    
    if (equity > 0.8) {
      // При очень большом преимуществе возможен бэкгаммон
      winBG = Math.min(0.1, (equity - 0.8) * 0.3);
    }
    
    // Вероятности проигрыша с гаммоном/бэкгаммоном
    let loseG = 0;
    let loseBG = 0;
    
    if (equity < -0.3) {
      loseG = Math.min(0.3, Math.abs(equity + 0.3) * 0.5);
    }
    
    if (equity < -0.8) {
      loseBG = Math.min(0.1, Math.abs(equity + 0.8) * 0.3);
    }
    
    // Нормализуем: обычная победа = общая победа минус гаммоны
    win = Math.max(0, win - winG - winBG);
    
    return {
      win: Math.max(0, Math.min(1, win)),
      winG: Math.max(0, Math.min(1, winG)),
      winBG: Math.max(0, Math.min(1, winBG)),
      loseG: Math.max(0, Math.min(1, loseG)),
      loseBG: Math.max(0, Math.min(1, loseBG)),
    };
  }
}

