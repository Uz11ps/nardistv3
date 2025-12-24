import { Injectable } from '@nestjs/common';
import { GameMode, GameType } from '../games/game.entity';

/**
 * Сервис для расчёта XP согласно спецификации Nardist_XP_Leveling_Spec_v1_2
 */
@Injectable()
export class XpCalculatorService {
  // Параметр кривой для уровней 1-5
  private readonly A = 350;
  private readonly MAX_LEVEL = 50;

  /**
   * Вычисляет множитель для уровня согласно формуле GWars-style
   */
  private getLevelFactor(level: number): number {
    if (level <= 5) {
      return this.A;
    } else if (level >= 50) {
      return 1;
    } else {
      const t = (level - 5) / 45;
      return Math.exp(Math.log(this.A) * (1 - t));
    }
  }

  /**
   * Вычисляет порог XP для уровня используя GWars-style кривую
   * Формула: XP_threshold[L] = round( XP_GWars_threshold[L] * factor(L) )
   * Использует точную таблицу порогов из Приложения A спецификации
   */
  getXPThresholdForLevel(level: number): number {
    if (level <= 1) return 0;
    
    // Используем точную таблицу порогов из спецификации (таблица 11)
    // Пороги уже рассчитаны с учетом фактора, поэтому просто возвращаем значение
    return this.getGWarsThreshold(level);
  }

  /**
   * Точная таблица порогов XP из Приложения A спецификации
   * Таблица 11: Пороги XP для уровней 1-50
   */
  private getGWarsThreshold(level: number): number {
    // Точная таблица порогов XP_total из таблицы 11 спецификации
    const xpThresholds: { [key: number]: number } = {
      1: 1750,
      2: 5250,
      3: 12950,
      4: 26600,
      5: 50050,
      6: 76513,
      7: 111146,
      8: 155133,
      9: 223947,
      10: 274745,
      11: 352439,
      12: 443095,
      13: 547630,
      14: 666572,
      15: 800499,
      16: 949816,
      17: 1114974,
      18: 1295961,
      19: 1493088,
      20: 1706122,
      21: 1934944,
      22: 2179337,
      23: 2438855,
      24: 2712961,
      25: 3001086,
      26: 3302515,
      27: 3616468,
      28: 3942042,
      29: 4278291,
      30: 4624199,
      31: 4978683,
      32: 5340636,
      33: 5873467,
      34: 6082246,
      35: 6459491,
      36: 6839392,
      37: 7220716,
      38: 7602217,
      39: 7982686,
      40: 8360902,
      41: 8789105,
      42: 9331625,
      43: 10064568,
      44: 11087641,
      45: 12541240,
      46: 14633038,
      47: 17681154,
      48: 22186326,
      49: 28955279,
      50: 39315825,
    };
    
    return xpThresholds[level] || 0;
  }

  /**
   * Вычисляет общий XP для уровня (сумма всех переходов до этого уровня)
   */
  getTotalXPForLevel(level: number): number {
    if (level <= 1) return 0;
    
    let totalXP = 0;
    for (let i = 2; i <= level; i++) {
      totalXP += this.getXPThresholdForLevel(i);
    }
    return totalXP;
  }

  /**
   * Вычисляет уровень на основе общего XP
   */
  getLevelFromTotalXP(totalXP: number): number {
    if (totalXP <= 0) return 1;
    
    let level = 1;
    while (level < this.MAX_LEVEL) {
      const xpForNextLevel = this.getTotalXPForLevel(level + 1);
      if (totalXP >= xpForNextLevel) {
        level++;
      } else {
        break;
      }
    }
    return level;
  }

  /**
   * Базовый XP по режимам игры
   * Согласно таблице 3 из спецификации Nardist_XP_Leveling_Spec_v1_2
   */
  getBaseXP(mode: GameMode, gameType: GameType, stake?: number): number {
    // Если есть ставка (игра на NAR-coin), используем "баталию" на NAR
    if (stake && stake > 0) {
      return 3100; // PvP "баталия" на NAR (из таблицы 3)
    }
    
    // Базовые значения XP согласно таблице 3 спецификации
    const baseXP: { [key: string]: number } = {
      'SHORT_VS_PLAYER': 2800,      // PvP рейтинговый
      'LONG_VS_PLAYER': 2800,       // PvP рейтинговый
      'SHORT_VS_BOT': 250,          // Тренировка vs AI
      'LONG_VS_BOT': 250,           // Тренировка vs AI
      'SHORT_TOURNAMENT': 4500,     // Турнирный матч
      'LONG_TOURNAMENT': 4500,      // Турнирный матч
      // Дружеский матч: 1200 (пока не реализован как отдельный режим)
    };

    const key = `${mode}_${gameType}`;
    return baseXP[key] || 250; // По умолчанию минимальный XP (тренировка)
  }

  /**
   * ResultMult - множитель исхода матча
   * Победа: 1.0, Поражение: 0.7
   */
  getResultMultiplier(playerWon: boolean): number {
    return playerWon ? 1.0 : 0.7;
  }

  /**
   * OpponentMult - множитель силы соперника
   * OpponentMult = clamp( 1 + (OppRating - YourRating)/2000 , 0.85 , 1.20 )
   */
  getOpponentMultiplier(playerRating: number, opponentRating: number): number {
    const diff = (opponentRating - playerRating) / 2000;
    return Math.max(0.85, Math.min(1.20, 1 + diff));
  }

  /**
   * RepeatOpponentMult - анти-фарм за 24 часа
   * Согласно таблице 5 из спецификации Nardist_XP_Leveling_Spec_v1_2
   */
  getRepeatOpponentMultiplier(
    matchesCount: number, // Количество матчей с этим соперником за 24 часа
  ): number {
    // Точная таблица из спецификации (таблица 5)
    const multipliers: { [key: number]: number } = {
      1: 1.00,
      2: 0.90,
      3: 0.85,
      4: 0.80,
      5: 0.75,
      6: 0.70,
      7: 0.65,
      8: 0.60,
      9: 0.55,
    };
    
    // Для 10+ матчей множитель = 0.50 (пол)
    if (matchesCount >= 10) {
      return 0.50;
    }
    
    return multipliers[matchesCount] || 1.00;
  }

  /**
   * GearXPMult - бонус XP от предметов (скинов)
   * GearXPMult = min( 1 + Σ(item_xp_bonus) , 1.50 )
   */
  getGearXPMult(itemsXPBonus: number[]): number {
    const totalBonus = itemsXPBonus.reduce((sum, bonus) => sum + bonus, 0);
    return Math.min(1 + totalBonus, 1.50);
  }

  /**
   * MarsMult - победа "Марсом" (разгром)
   * Множитель 1.50 для разгромной победы
   */
  getMarsMultiplier(isMarsWin: boolean): number {
    return isMarsWin ? 1.50 : 1.00;
  }

  /**
   * CleanPlayMult - античит/доверие
   * Возвращает множитель в зависимости от доверия к игроку
   */
  getCleanPlayMultiplier(trustLevel: 'high' | 'medium' | 'low' | 'banned'): number {
    const multipliers = {
      high: 1.0,
      medium: 0.7,
      low: 0.5,
      banned: 0.0,
    };
    return multipliers[trustLevel] || 1.0;
  }

  /**
   * Основная функция расчёта XP за матч
   */
  calculateXP(params: {
    mode: GameMode;
    gameType: GameType;
    playerWon: boolean;
    playerRating: number;
    opponentRating: number;
    repeatMatchesCount: number; // Количество матчей с этим соперником за 24 часа
    itemsXPBonus: number[]; // Массив бонусов XP от предметов
    isMarsWin: boolean;
    trustLevel: 'high' | 'medium' | 'low' | 'banned';
    stake?: number; // Ставка в NAR-coin (для определения типа игры)
  }): number {
    const baseXP = this.getBaseXP(params.mode, params.gameType, params.stake);
    
    const resultMult = this.getResultMultiplier(params.playerWon);
    const opponentMult = this.getOpponentMultiplier(params.playerRating, params.opponentRating);
    const repeatMult = this.getRepeatOpponentMultiplier(params.repeatMatchesCount);
    const gearMult = this.getGearXPMult(params.itemsXPBonus);
    const marsMult = this.getMarsMultiplier(params.isMarsWin);
    const cleanMult = this.getCleanPlayMultiplier(params.trustLevel);

    let xp = baseXP * resultMult * opponentMult * repeatMult * gearMult * marsMult * cleanMult;
    
    // Защитный кап: XP_final = min(XP, BaseXP(mode) * 2.50)
    xp = Math.min(xp, baseXP * 2.50);
    
    return Math.floor(xp);
  }
}

