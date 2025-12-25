import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Конфигурация системы прогрессии
 * Хранит все коэффициенты и параметры для балансировки
 */
@Entity('progression_config')
export class ProgressionConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  config: {
    // Skill Points
    skillPoints: {
      levels2To5: number; // SP за уровни 2-5
      levels6To50: number; // SP за уровни 6-50
    };
    // Лицензия предпринимателя
    license: {
      requiredLevel: number;
      costNar: number;
    };
    // Комиссия
    commission: {
      base: number; // Базовая комиссия (0.15 = 15%)
      min: number; // Минимальная комиссия (0.05 = 5%)
      statsMin: number; // Минимум от ветки Экономика (0.07 = 7%)
      gearBonusCap: number; // Максимальный бонус от экипировки (0.02 = 2%)
    };
    // Ветка Экономика
    economyBranch: {
      step1Sp: number; // Первый шаг (20 SP)
      step1K: number; // Коэффициент первого шага (0.0025)
      step2Sp: number; // Второй шаг (20 SP)
      step2K: number; // Коэффициент второго шага (0.0015)
      reductionCap: number; // Максимальное снижение (0.08 = 8%)
      passiveK: number; // Коэффициент пассивного дохода (0.015)
      passiveSpCap: number; // Кап SP для пассивного дохода (40)
    };
    // Ветка Энергия
    energyBranch: {
      baseMax: number; // Базовый максимум (100)
      maxStep1Sp: number; // Первый шаг для максимума (30 SP)
      maxStep1K: number; // Коэффициент первого шага (4)
      maxStep2K: number; // Коэффициент второго шага (2)
      regenBasePerH: number; // Базовая регенерация в час (10)
      regenStep1Sp: number; // Первый шаг для регенерации (20 SP)
      regenStep1K: number; // Коэффициент первого шага (1.0)
      regenStep2Sp: number; // Второй шаг для регенерации (20 SP)
      regenStep2K: number; // Коэффициент второго шага (0.5)
      refill: {
        amount: number; // Количество за покупку (50)
        baseCostNar: number; // Базовая цена (120)
        growth: number; // Рост цены (1.35)
      };
    };
    // Ветка Жизни
    livesBranch: {
      baseMax: number; // Базовый максимум (100)
      maxStep1Sp: number; // Первый шаг для максимума (30 SP)
      maxStep1K: number; // Коэффициент первого шага (4)
      maxStep2K: number; // Коэффициент второго шага (2)
      regenBasePerH: number; // Базовая регенерация в час (1)
      regenSpCap: number; // Кап SP для регенерации (30)
      regenSpStep: number; // Шаг для регенерации (10 SP)
      lifeLossProtectCap: number; // Максимальная защита (0.25 = 25%)
      lifeLossProtectSpCap: number; // Кап SP для защиты (10)
      refill: {
        amount: number; // Количество за покупку (5)
        baseCostNar: number; // Базовая цена (200)
        growth: number; // Рост цены (1.40)
      };
    };
    // Ветка Сила
    powerBranch: {
      weightBase: number; // Базовый вес (10)
      weightK: number; // Коэффициент веса (2.5)
    };
    // Капы
    caps: {
      gearXpMultCap: number; // Максимальный множитель XP от экипировки (1.50)
    };
    // Общие параметры XP кривой
    xpCurve: {
      A: number; // 350
    };
    maxLevel: number; // 50
    // Награды за уровень
    levelRewards: { [key: number]: number }; // Награда NAR за уровень L
    // XP и уровни
    xp: {
      baseXp: {
        pvpRanked: number; // PvP рейтинговый (2800)
        pvpBatalia: number; // PvP "баталия" на NAR (3100)
        tournament: number; // Турнирный матч (4500)
        friendly: number; // Дружеский матч (1200)
        ai: number; // Тренировка vs AI (250)
      };
      multipliers: {
        win: number; // Победа (1.00)
        loss: number; // Поражение (0.70)
        marsWin: number; // Победа Марсом (1.50)
        repeatOpponent: number[]; // Множители за повторные игры [1.0, 0.9, 0.85, ...]
      };
      caps: {
        maxMatchXpMult: number; // Максимальный XP за матч (BaseXP * 2.50)
      };
      thresholds: { [key: number]: number }; // Пороги XP для уровней 1-50
    };
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

