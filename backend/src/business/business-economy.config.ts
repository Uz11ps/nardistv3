// Конфигурация экономики бизнесов по классам A/B/C
import { DistrictName } from './district.entity';

export interface BusinessLevelConfig {
  level: number;
  narPerHour: number;
  costNar: number;
  costType: 'purchase' | 'upgrade';
  paybackDays: number; // Окупаемость по приросту
  requiredLevel?: number;
  requiredQuest?: string;
  requiredMaterials?: number; // M: N ед.
  requiredLicense?: string;
}

export const BUSINESS_CLASS_A: BusinessLevelConfig[] = [
  { level: 1, narPerHour: 10, costNar: 720, costType: 'purchase', paybackDays: 3.0 },
  { level: 2, narPerHour: 12, costNar: 336, costType: 'upgrade', paybackDays: 7.0, requiredLevel: 5 },
  { level: 3, narPerHour: 14, costNar: 480, costType: 'upgrade', paybackDays: 10.0, requiredLevel: 6 },
  { level: 4, narPerHour: 17, costNar: 1008, costType: 'upgrade', paybackDays: 14.0, requiredLevel: 7 },
  { level: 5, narPerHour: 20, costNar: 1512, costType: 'upgrade', paybackDays: 21.0, requiredLevel: 8 },
  { level: 6, narPerHour: 24, costNar: 2880, costType: 'upgrade', paybackDays: 30.0, requiredLevel: 10, requiredMaterials: 12 },
  { level: 7, narPerHour: 29, costNar: 5400, costType: 'upgrade', paybackDays: 45.0, requiredLevel: 12, requiredMaterials: 18 },
  { level: 8, narPerHour: 35, costNar: 8640, costType: 'upgrade', paybackDays: 60.0, requiredLevel: 15, requiredMaterials: 26 },
  { level: 9, narPerHour: 42, costNar: 15120, costType: 'upgrade', paybackDays: 90.0, requiredLevel: 18, requiredMaterials: 36 },
  { level: 10, narPerHour: 50, costNar: 23040, costType: 'upgrade', paybackDays: 120.0, requiredLevel: 22, requiredMaterials: 50 },
];

export const BUSINESS_CLASS_B: BusinessLevelConfig[] = [
  { level: 1, narPerHour: 25, costNar: 1800, costType: 'purchase', paybackDays: 3.0 },
  { level: 2, narPerHour: 30, costNar: 840, costType: 'upgrade', paybackDays: 7.0, requiredLevel: 5 },
  { level: 3, narPerHour: 36, costNar: 1440, costType: 'upgrade', paybackDays: 10.0, requiredLevel: 6 },
  { level: 4, narPerHour: 43, costNar: 2352, costType: 'upgrade', paybackDays: 14.0, requiredLevel: 7 },
  { level: 5, narPerHour: 52, costNar: 4536, costType: 'upgrade', paybackDays: 21.0, requiredLevel: 8 },
  { level: 6, narPerHour: 62, costNar: 7200, costType: 'upgrade', paybackDays: 30.0, requiredLevel: 10, requiredMaterials: 12 },
  { level: 7, narPerHour: 75, costNar: 14040, costType: 'upgrade', paybackDays: 45.0, requiredLevel: 12, requiredMaterials: 18 },
  { level: 8, narPerHour: 90, costNar: 21600, costType: 'upgrade', paybackDays: 60.0, requiredLevel: 15, requiredMaterials: 26 },
  { level: 9, narPerHour: 108, costNar: 38880, costType: 'upgrade', paybackDays: 90.0, requiredLevel: 18, requiredMaterials: 36 },
  { level: 10, narPerHour: 130, costNar: 63360, costType: 'upgrade', paybackDays: 120.0, requiredLevel: 22, requiredMaterials: 50 },
];

export const BUSINESS_CLASS_C: BusinessLevelConfig[] = [
  { level: 1, narPerHour: 60, costNar: 4320, costType: 'purchase', paybackDays: 3.0 },
  { level: 2, narPerHour: 72, costNar: 2016, costType: 'upgrade', paybackDays: 7.0, requiredLevel: 5 },
  { level: 3, narPerHour: 86, costNar: 3360, costType: 'upgrade', paybackDays: 10.0, requiredLevel: 6 },
  { level: 4, narPerHour: 103, costNar: 5712, costType: 'upgrade', paybackDays: 14.0, requiredLevel: 7 },
  { level: 5, narPerHour: 124, costNar: 10584, costType: 'upgrade', paybackDays: 21.0, requiredLevel: 8 },
  { level: 6, narPerHour: 149, costNar: 18000, costType: 'upgrade', paybackDays: 30.0, requiredLevel: 10, requiredMaterials: 12 },
  { level: 7, narPerHour: 179, costNar: 32400, costType: 'upgrade', paybackDays: 45.0, requiredLevel: 12, requiredMaterials: 18 },
  { level: 8, narPerHour: 215, costNar: 51840, costType: 'upgrade', paybackDays: 60.0, requiredLevel: 15, requiredMaterials: 26 },
  { level: 9, narPerHour: 258, costNar: 92880, costType: 'upgrade', paybackDays: 90.0, requiredLevel: 18, requiredMaterials: 36 },
  { level: 10, narPerHour: 310, costNar: 149760, costType: 'upgrade', paybackDays: 120.0, requiredLevel: 22, requiredMaterials: 50 },
];

export function getBusinessConfig(businessClass: string): BusinessLevelConfig[] {
  switch (businessClass) {
    case 'A':
      return BUSINESS_CLASS_A;
    case 'B':
      return BUSINESS_CLASS_B;
    case 'C':
      return BUSINESS_CLASS_C;
    default:
      return BUSINESS_CLASS_A;
  }
}

export function getBusinessLevelConfig(businessClass: string, level: number): BusinessLevelConfig | null {
  const config = getBusinessConfig(businessClass);
  return config.find(c => c.level === level) || null;
}

// Конфигурация дропа материалов из матчей
export interface MaterialDropConfig {
  stake: number;
  winnerChance: number; // Шанс дропа для победителя (%)
  loserChance: number; // Шанс дропа для проигравшего (%)
  winnerAmount: { min: number; max: number; weights: number[] }; // Количество материалов
  loserAmount: { min: number; max: number; weights: number[] };
  winnerSorts: { s1: number; s2: number; s3: number; s4: number }; // Шансы сортов (%)
  loserSorts: { s1: number; s2: number; s3: number; s4: number };
}

export const MATERIAL_DROP_CONFIG: MaterialDropConfig[] = [
  { stake: 50, winnerChance: 18, loserChance: 9, winnerAmount: { min: 1, max: 1, weights: [100] }, loserAmount: { min: 1, max: 1, weights: [100] }, winnerSorts: { s1: 92, s2: 8, s3: 0, s4: 0 }, loserSorts: { s1: 96, s2: 4, s3: 0, s4: 0 } },
  { stake: 100, winnerChance: 22, loserChance: 11, winnerAmount: { min: 1, max: 2, weights: [50, 50] }, loserAmount: { min: 1, max: 1, weights: [100] }, winnerSorts: { s1: 88, s2: 12, s3: 0, s4: 0 }, loserSorts: { s1: 93, s2: 7, s3: 0, s4: 0 } },
  { stake: 250, winnerChance: 28, loserChance: 14, winnerAmount: { min: 1, max: 2, weights: [60, 40] }, loserAmount: { min: 1, max: 1, weights: [100] }, winnerSorts: { s1: 82, s2: 16, s3: 2, s4: 0 }, loserSorts: { s1: 88, s2: 11, s3: 1, s4: 0 } },
  { stake: 500, winnerChance: 34, loserChance: 17, winnerAmount: { min: 2, max: 3, weights: [70, 30] }, loserAmount: { min: 1, max: 2, weights: [70, 30] }, winnerSorts: { s1: 76, s2: 20, s3: 4, s4: 0 }, loserSorts: { s1: 84, s2: 14, s3: 2, s4: 0 } },
  { stake: 1000, winnerChance: 40, loserChance: 20, winnerAmount: { min: 2, max: 3, weights: [50, 50] }, loserAmount: { min: 1, max: 2, weights: [50, 50] }, winnerSorts: { s1: 68, s2: 24, s3: 7, s4: 1 }, loserSorts: { s1: 78, s2: 18, s3: 4, s4: 0 } },
  { stake: 3000, winnerChance: 46, loserChance: 23, winnerAmount: { min: 3, max: 4, weights: [70, 30] }, loserAmount: { min: 2, max: 3, weights: [70, 30] }, winnerSorts: { s1: 60, s2: 26, s3: 12, s4: 2 }, loserSorts: { s1: 72, s2: 20, s3: 7, s4: 1 } },
  { stake: 5000, winnerChance: 52, loserChance: 26, winnerAmount: { min: 3, max: 4, weights: [40, 60] }, loserAmount: { min: 2, max: 3, weights: [40, 60] }, winnerSorts: { s1: 54, s2: 28, s3: 15, s4: 3 }, loserSorts: { s1: 66, s2: 22, s3: 10, s4: 2 } },
  { stake: 10000, winnerChance: 60, loserChance: 30, winnerAmount: { min: 4, max: 5, weights: [50, 50] }, loserAmount: { min: 2, max: 3, weights: [30, 70] }, winnerSorts: { s1: 46, s2: 30, s3: 20, s4: 4 }, loserSorts: { s1: 60, s2: 24, s3: 14, s4: 2 } },
];

// Конфигурация времени перемещения между районами (в минутах)
export const DISTRICT_TRAVEL_TIME: Record<string, Record<string, number>> = {
  [DistrictName.COURTYARDS]: { [DistrictName.MASTERS_QUARTER]: 12 },
  [DistrictName.MASTERS_QUARTER]: { [DistrictName.TRADE_GALLERY]: 10 },
  [DistrictName.TRADE_GALLERY]: { [DistrictName.ACADEMY]: 15 },
  [DistrictName.ACADEMY]: { [DistrictName.CLUB_PROSPECT]: 15 },
  [DistrictName.CLUB_PROSPECT]: { [DistrictName.CATHEDRAL_SQUARE]: 20 },
  [DistrictName.CATHEDRAL_SQUARE]: { [DistrictName.SUPPLY_PIER]: 18 },
  [DistrictName.SUPPLY_PIER]: { [DistrictName.COURTYARDS]: 25 },
};

// Обратное направление (кольцо)
export const DISTRICT_TRAVEL_TIME_REVERSE: Record<string, Record<string, number>> = {
  [DistrictName.MASTERS_QUARTER]: { [DistrictName.COURTYARDS]: 12 },
  [DistrictName.TRADE_GALLERY]: { [DistrictName.MASTERS_QUARTER]: 10 },
  [DistrictName.ACADEMY]: { [DistrictName.TRADE_GALLERY]: 15 },
  [DistrictName.CLUB_PROSPECT]: { [DistrictName.ACADEMY]: 15 },
  [DistrictName.CATHEDRAL_SQUARE]: { [DistrictName.CLUB_PROSPECT]: 20 },
  [DistrictName.SUPPLY_PIER]: { [DistrictName.CATHEDRAL_SQUARE]: 18 },
  [DistrictName.COURTYARDS]: { [DistrictName.SUPPLY_PIER]: 25 },
};

export function getTravelTime(from: DistrictName, to: DistrictName): number {
  return DISTRICT_TRAVEL_TIME[from]?.[to] || DISTRICT_TRAVEL_TIME_REVERSE[from]?.[to] || 0;
}

