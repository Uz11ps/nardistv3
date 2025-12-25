/**
 * Константы Equipment Spec v2.0
 */

// Слоты экипировки
export enum EquipmentSlot {
  BOARD = 'BOARD',
  DIE_1 = 'DIE_1',
  DIE_2 = 'DIE_2',
  CHECKERS = 'CHECKERS',
  CUP = 'CUP',
  CLOCK = 'CLOCK',
  CASE = 'CASE',
}

// Редкости
export enum EquipmentRarity {
  COMMON = 'COMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
  MYTHIC = 'MYTHIC',
  OLYMPIC_UNIQUE = 'OLYMPIC_UNIQUE',
}

// Режимы износа
export enum WearMode {
  PER_MATCH = 'PER_MATCH',
  PER_ROLL = 'PER_ROLL',
}

// Типы бонусов
export enum BonusType {
  XP_MULT = 'XP_MULT', // Множитель опыта (например 1.10 = +10%)
  COMMISSION_REDUCTION = 'COMMISSION_REDUCTION', // Снижение комиссии (например 0.003 = -0.3%)
  ENERGY_REFILL_DISCOUNT = 'ENERGY_REFILL_DISCOUNT', // Скидка на восстановление энергии (например 0.05 = -5%)
  LIFE_REFILL_DISCOUNT = 'LIFE_REFILL_DISCOUNT', // Скидка на восстановление жизней
  WEAR_REDUCTION = 'WEAR_REDUCTION', // Снижение износа (например 0.10 = -10%)
  REPAIR_DISCOUNT = 'REPAIR_DISCOUNT', // Скидка на ремонт (например 0.10 = -10%)
  LIFE_LOSS_PROTECT_CHANCE = 'LIFE_LOSS_PROTECT_CHANCE', // Шанс не потерять жизнь (например 0.05 = 5%)
}

// Прочность по редкости (PER_MATCH предметы)
export const DURABILITY_MAX_PER_MATCH: Record<EquipmentRarity, number> = {
  [EquipmentRarity.COMMON]: 100,
  [EquipmentRarity.RARE]: 150,
  [EquipmentRarity.EPIC]: 220,
  [EquipmentRarity.LEGENDARY]: 320,
  [EquipmentRarity.MYTHIC]: 450,
  [EquipmentRarity.OLYMPIC_UNIQUE]: 365, // Минимум, может быть больше
};

// Прочность по редкости (PER_ROLL предметы - кубики)
export const DURABILITY_MAX_PER_ROLL: Record<EquipmentRarity, number> = {
  [EquipmentRarity.COMMON]: 1800,
  [EquipmentRarity.RARE]: 3000,
  [EquipmentRarity.EPIC]: 4200,
  [EquipmentRarity.LEGENDARY]: 6000,
  [EquipmentRarity.MYTHIC]: 9000,
  [EquipmentRarity.OLYMPIC_UNIQUE]: 22000,
};

// Минимальные уровни для доступа к редкостям
export const REQUIRED_LEVEL_BY_RARITY: Record<EquipmentRarity, number> = {
  [EquipmentRarity.COMMON]: 1,
  [EquipmentRarity.RARE]: 5,
  [EquipmentRarity.EPIC]: 10,
  [EquipmentRarity.LEGENDARY]: 20,
  [EquipmentRarity.MYTHIC]: 35,
  [EquipmentRarity.OLYMPIC_UNIQUE]: 1, // Только через призы
};

// Ранний доступ за USDT (минимальный уровень)
export const EARLY_ACCESS_LEVEL_BY_RARITY: Record<EquipmentRarity, number> = {
  [EquipmentRarity.COMMON]: 1,
  [EquipmentRarity.RARE]: 5,
  [EquipmentRarity.EPIC]: 10,
  [EquipmentRarity.LEGENDARY]: 15,
  [EquipmentRarity.MYTHIC]: 25,
  [EquipmentRarity.OLYMPIC_UNIQUE]: 1, // Только через призы
};

// Потолки (лимиты)
export const EQUIPMENT_CAPS = {
  COMMISSION: {
    BASE: 0.15, // Базовая комиссия 15%
    MIN_FROM_STATS: 0.10, // Минимум от ветки "Экономика" 10%
    MIN_FINAL: 0.05, // Финальный минимум с экипировкой 5%
  },
  XP_MULT: {
    GEAR_CAP: 1.5, // Максимальный множитель XP от экипировки x1.50 (+50%)
  },
  LIFE_LOSS_PROTECT: {
    MAX: 0.25, // Максимальный шанс не потерять жизнь 25%
  },
  MARS_XP: {
    COOLDOWN_HOURS: 4, // Кулдаун в часах
    MULT: 2.0, // Удвоение
    MAX_TOTAL: 3.0, // Максимум: 1.5 * 2.0 = 3.0 (300% XP от базового)
  },
};

// Множители износа по зонам ремонта
export const REPAIR_ZONE_MULTIPLIERS = {
  A: 1.0, // durability_ratio > 0.50
  B: 1.3, // 0.25 < durability_ratio <= 0.50
  C: 1.8, // 0.00 < durability_ratio <= 0.25
};

// Множитель износа в турнирах
export const TOURNAMENT_WEAR_MULT = 2.0;

// Износ по умолчанию
export const DEFAULT_WEAR_AMOUNT = 1;

