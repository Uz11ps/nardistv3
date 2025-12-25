import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgressionConfig } from './progression-config.entity';
import { GameMode, GameType } from '../games/game.entity';

/**
 * Сервис для расчёта XP согласно спецификации Nardist_XP_Leveling_Spec_v1_2
 */
@Injectable()
export class XpCalculatorService implements OnModuleInit {
  constructor(
    @InjectRepository(ProgressionConfig)
    private readonly progressionConfigRepository: Repository<ProgressionConfig>,
  ) {}

  // Параметр кривой для уровней 1-5 (теперь через config)
  private A = 350;
  private MAX_LEVEL = 50;

  // Конфигурация по умолчанию
  private config = {
    xp: {
      baseXp: {
        pvpRanked: 2800,
        pvpBatalia: 3100,
        tournament: 4500,
        friendly: 1200,
        ai: 250,
      },
      multipliers: {
        win: 1.00,
        loss: 0.70,
        marsWin: 1.50,
        repeatOpponent: [1.00, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60, 0.55, 0.50],
      },
      caps: {
        maxMatchXpMult: 2.50,
      },
      thresholds: {
        1: 1750, 2: 5250, 3: 12950, 4: 26600, 5: 50050,
        6: 76513, 7: 111146, 8: 155133, 9: 223947, 10: 274745,
        11: 352439, 12: 443095, 13: 547630, 14: 666572, 15: 800499,
        16: 949816, 17: 1114974, 18: 1295961, 19: 1493088, 20: 1706122,
        21: 1934944, 22: 2179337, 23: 2438855, 24: 2712961, 25: 3001086,
        26: 3302515, 27: 3616468, 28: 3942042, 29: 4278291, 30: 4624199,
        31: 4978683, 32: 5340636, 33: 5873467, 34: 6082246, 35: 6459491,
        36: 6839392, 37: 7220716, 38: 7602217, 39: 7982686, 40: 8360902,
        41: 8789105, 42: 9331625, 43: 10064568, 44: 11087641, 45: 12541240,
        46: 14633038, 47: 17681154, 48: 22186326, 49: 28955279, 50: 39315825,
      },
    },
  };

  async onModuleInit() {
    await this.refreshConfig();
  }

  /**
   * Обновить конфигурацию из базы данных
   */
  async refreshConfig() {
    try {
      const dbConfig = await this.progressionConfigRepository.findOne({ where: {} });
      if (dbConfig && dbConfig.config) {
        if (dbConfig.config.xp) {
          this.config.xp = { ...this.config.xp, ...dbConfig.config.xp };
        }
        if (dbConfig.config.xpCurve && dbConfig.config.xpCurve.A) {
          this.A = dbConfig.config.xpCurve.A;
        }
        if (dbConfig.config.maxLevel) {
          this.MAX_LEVEL = dbConfig.config.maxLevel;
        }
      }
    } catch (error) {
      console.error('Error refreshing XP calculator config:', error);
    }
  }

  /**
   * Вычисляет множитель для уровня согласно формуле GWars-style
   */
  private getLevelFactor(level: number): number {
    if (level <= 5) {
      return this.A;
    } else if (level >= this.MAX_LEVEL) {
      return 1;
    } else {
      const t = (level - 5) / (this.MAX_LEVEL - 5);
      return Math.exp(Math.log(this.A) * (1 - t));
    }
  }

  /**
   * Вычисляет порог XP для уровня используя GWars-style кривую
   * Формула: XP_threshold[L] = round( XP_GWars_threshold[L] * factor(L) )
   * Использует таблицу порогов из конфигурации
   */
  getXPThresholdForLevel(level: number): number {
    if (level <= 1) return 0;
    return this.config.xp.thresholds[level] || 0;
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
    
    const maxLevel = (this as any).MAX_LEVEL || 50;
    let level = 1;
    while (level < maxLevel) {
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
   */
  getBaseXP(mode: GameMode, gameType: GameType, stake?: number): number {
    const { baseXp } = this.config.xp;
    
    if (stake && stake > 0) {
      return baseXp.pvpBatalia;
    }
    
    if (gameType === GameType.VS_BOT) {
      return baseXp.ai;
    }
    
    if (gameType === GameType.TOURNAMENT) {
      return baseXp.tournament;
    }
    
    return baseXp.pvpRanked;
  }

  /**
   * ResultMult - множитель исхода матча
   */
  getResultMultiplier(playerWon: boolean): number {
    const { multipliers } = this.config.xp;
    return playerWon ? multipliers.win : multipliers.loss;
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
   */
  getRepeatOpponentMultiplier(
    matchesCount: number, // Количество матчей с этим соперником за 24 часа
  ): number {
    const { repeatOpponent } = this.config.xp.multipliers;
    
    if (matchesCount >= repeatOpponent.length) {
      return repeatOpponent[repeatOpponent.length - 1];
    }
    
    return repeatOpponent[matchesCount - 1] || 1.00;
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
   */
  getMarsMultiplier(isMarsWin: boolean): number {
    const { multipliers } = this.config.xp;
    return isMarsWin ? multipliers.marsWin : 1.00;
  }

  /**
   * CleanPlayMult - античит/доверие
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
    
    // Защитный кап: XP_final = min(XP, BaseXP(mode) * maxMatchXpMult)
    xp = Math.min(xp, baseXP * this.config.xp.caps.maxMatchXpMult);
    
    return Math.floor(xp);
  }
}

