import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgressionConfig } from './progression-config.entity';
import { EnhancementType } from './enhancement.entity';

/**
 * Сервис для расчета характеристик по веткам прокачки
 * Согласно спецификации Nardist_Progression_Branches_Spec_v1_1
 */
@Injectable()
export class ProgressionBranchesService implements OnModuleInit {
  constructor(
    @InjectRepository(ProgressionConfig)
    private readonly progressionConfigRepository: Repository<ProgressionConfig>,
  ) {}

  // Конфигурация по умолчанию (из документа)
  private config = {
    skillPoints: {
      levels2To5: 1,
      levels6To50: 2,
    },
    license: {
      requiredLevel: 5,
      costNar: 10000,
    },
    commission: {
      base: 0.15, // 15%
      min: 0.05, // 5%
      statsMin: 0.07, // 7%
      gearBonusCap: 0.02, // 2%
    },
    economyBranch: {
      step1Sp: 20,
      step1K: 0.0025,
      step2Sp: 20,
      step2K: 0.0015,
      reductionCap: 0.08, // 8%
      passiveK: 0.015,
      passiveSpCap: 40,
    },
    energyBranch: {
      baseMax: 100,
      maxStep1Sp: 30,
      maxStep1K: 4,
      maxStep2K: 2,
      regenBasePerH: 10,
      regenStep1Sp: 20,
      regenStep1K: 1.0,
      regenStep2Sp: 20,
      regenStep2K: 0.5,
      refill: {
        amount: 50,
        baseCostNar: 120,
        growth: 1.35,
      },
    },
    livesBranch: {
      baseMax: 100,
      maxStep1Sp: 30,
      maxStep1K: 4,
      maxStep2K: 2,
      regenBasePerH: 1,
      regenSpCap: 30,
      regenSpStep: 10,
      lifeLossProtectCap: 0.25, // 25%
      lifeLossProtectSpCap: 10,
      refill: {
        amount: 5,
        baseCostNar: 200,
        growth: 1.40,
      },
    },
    powerBranch: {
      weightBase: 10,
      weightK: 2.5,
    },
    caps: {
      gearXpMultCap: 1.50,
    },
    xpCurve: {
      A: 350,
    },
    maxLevel: 50,
    levelRewards: {} as Record<number, number>,
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
      thresholds: {} as Record<number, number>,
      mars: {
        cooldownHours: 4,
        mult: 2.0,
      },
    },
    equipment: {
      wear: {
        tournamentMult: 2.0,
        perMatchDefault: 1,
        perRollDefault: 1,
      },
      repair: {
        levelMultPerLevel: 0.01,
        zoneMult: {
          A: 1.0,
          B: 1.3,
          C: 1.8,
        },
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
        this.config = { ...this.config, ...dbConfig.config };
      }
    } catch (error) {
      console.error('Error refreshing progression config:', error);
    }
  }

  /**
   * Получить текущую конфигурацию
   */
  getConfig() {
    return this.config;
  }

  /**
   * Получить максимальный уровень из конфигурации
   */
  getMaxLevel(): number {
    return this.config.maxLevel || 50;
  }

  /**
   * ЭКОНОМИКА: Рассчитать снижение комиссии от ветки
   * Формула: economy_commission_reduction = step1K * min(econ_sp, step1Sp) + step2K * min(max(econ_sp - step1Sp, 0), step2Sp)
   */
  calculateEconomyCommissionReduction(econSp: number): number {
    const { step1Sp, step1K, step2Sp, step2K, reductionCap } = this.config.economyBranch;
    
    const step1Reduction = step1K * Math.min(econSp, step1Sp);
    const step2Reduction = step2K * Math.min(Math.max(econSp - step1Sp, 0), step2Sp);
    
    const totalReduction = step1Reduction + step2Reduction;
    return Math.min(totalReduction, reductionCap);
  }

  /**
   * ЭКОНОМИКА: Рассчитать итоговую комиссию с учетом ветки и экипировки
   * commission_from_stats = commission_base - economy_commission_reduction
   * commission_final = max(commission_from_stats - gear_commission_bonus, commission_min)
   */
  calculateFinalCommission(
    econSp: number,
    gearCommissionBonus: number = 0,
  ): number {
    const { base, min, statsMin, gearBonusCap } = this.config.commission;
    
    // Снижение от ветки Экономика
    const economyReduction = this.calculateEconomyCommissionReduction(econSp);
    const commissionFromStats = base - economyReduction;
    
    // Проверяем, что не ниже минимума от ветки
    const effectiveCommissionFromStats = Math.max(commissionFromStats, statsMin);
    
    // Применяем бонус от экипировки (с капом)
    const effectiveGearBonus = Math.min(gearCommissionBonus, gearBonusCap);
    const commissionFinal = Math.max(effectiveCommissionFromStats - effectiveGearBonus, min);
    
    return commissionFinal;
  }

  /**
   * ЭКОНОМИКА: Рассчитать пассивный доход от бизнеса
   * passive_income_mult = 1 + passive_k * min(econ_sp, passive_sp_cap)
   */
  calculatePassiveIncomeMultiplier(econSp: number): number {
    const { passiveK, passiveSpCap } = this.config.economyBranch;
    return 1 + passiveK * Math.min(econSp, passiveSpCap);
  }

  /**
   * ЭНЕРГИЯ: Рассчитать максимальную энергию
   * energy_max = base_max + max_step1_k * min(energy_sp, max_step1_sp) + max_step2_k * max(energy_sp - max_step1_sp, 0)
   */
  calculateMaxEnergy(energySp: number): number {
    const { baseMax, maxStep1Sp, maxStep1K, maxStep2K } = this.config.energyBranch;
    
    const step1Bonus = maxStep1K * Math.min(energySp, maxStep1Sp);
    const step2Bonus = maxStep2K * Math.max(energySp - maxStep1Sp, 0);
    
    return baseMax + step1Bonus + step2Bonus;
  }

  /**
   * ЭНЕРГИЯ: Рассчитать регенерацию энергии в час
   * energy_regen_per_h = regen_base_per_h + regen_step1_k * min(energy_sp, regen_step1_sp) + regen_step2_k * min(max(energy_sp - regen_step1_sp, 0), regen_step2_sp)
   */
  calculateEnergyRegenPerHour(energySp: number): number {
    const { regenBasePerH, regenStep1Sp, regenStep1K, regenStep2Sp, regenStep2K } = this.config.energyBranch;
    
    const step1Regen = regenStep1K * Math.min(energySp, regenStep1Sp);
    const step2Regen = regenStep2K * Math.min(Math.max(energySp - regenStep1Sp, 0), regenStep2Sp);
    
    return regenBasePerH + step1Regen + step2Regen;
  }

  /**
   * ЖИЗНИ: Рассчитать максимальные жизни
   * lives_max = base_max + max_step1_k * min(lives_sp, max_step1_sp) + max_step2_k * max(lives_sp - max_step1_sp, 0)
   */
  calculateMaxLives(livesSp: number): number {
    const { baseMax, maxStep1Sp, maxStep1K, maxStep2K } = this.config.livesBranch;
    
    const step1Bonus = maxStep1K * Math.min(livesSp, maxStep1Sp);
    const step2Bonus = maxStep2K * Math.max(livesSp - maxStep1Sp, 0);
    
    return baseMax + step1Bonus + step2Bonus;
  }

  /**
   * ЖИЗНИ: Рассчитать регенерацию жизней в час
   * lives_regen_per_h = regen_base_per_h + floor(min(lives_sp, regen_sp_cap) / regen_sp_step)
   */
  calculateLivesRegenPerHour(livesSp: number): number {
    const { regenBasePerH, regenSpCap, regenSpStep } = this.config.livesBranch;
    
    const regenBonus = Math.floor(Math.min(livesSp, regenSpCap) / regenSpStep);
    return regenBasePerH + regenBonus;
  }

  /**
   * ЖИЗНИ: Рассчитать защиту от потери жизни
   * life_loss_protect = min(0.01 * min(lives_sp, life_loss_protect_sp_cap) + gear_life_protect, life_loss_protect_cap)
   */
  calculateLifeLossProtection(livesSp: number, gearLifeProtect: number = 0): number {
    const { lifeLossProtectCap, lifeLossProtectSpCap } = this.config.livesBranch;
    
    const spProtection = 0.01 * Math.min(livesSp, lifeLossProtectSpCap);
    const totalProtection = spProtection + gearLifeProtect;
    
    return Math.min(totalProtection, lifeLossProtectCap);
  }

  /**
   * СИЛА: Рассчитать лимит веса экипировки
   * weight_limit = weight_base + weight_k * power_sp
   */
  calculateWeightLimit(powerSp: number): number {
    const { weightBase, weightK } = this.config.powerBranch;
    return weightBase + weightK * powerSp;
  }

  /**
   * Получить все характеристики игрока на основе распределения SP
   */
  calculateAllStats(params: {
    econSp: number;
    energySp: number;
    livesSp: number;
    powerSp: number;
    gearCommissionBonus?: number;
    gearLifeProtect?: number;
  }) {
    return {
      economy: {
        commissionReduction: this.calculateEconomyCommissionReduction(params.econSp),
        finalCommission: this.calculateFinalCommission(params.econSp, params.gearCommissionBonus),
        passiveIncomeMultiplier: this.calculatePassiveIncomeMultiplier(params.econSp),
      },
      energy: {
        max: this.calculateMaxEnergy(params.energySp),
        regenPerHour: this.calculateEnergyRegenPerHour(params.energySp),
      },
      lives: {
        max: this.calculateMaxLives(params.livesSp),
        regenPerHour: this.calculateLivesRegenPerHour(params.livesSp),
        lossProtection: this.calculateLifeLossProtection(params.livesSp, params.gearLifeProtect),
      },
      power: {
        weightLimit: this.calculateWeightLimit(params.powerSp),
      },
    };
  }
}

