import {
  EquipmentSlot,
  EquipmentRarity,
  WearMode,
  DURABILITY_MAX_PER_MATCH,
  DURABILITY_MAX_PER_ROLL,
  REPAIR_ZONE_MULTIPLIERS,
} from './equipment-spec.constants';

/**
 * Получает максимальную прочность по редкости и режиму износа
 */
export function getDurabilityMax(rarity: string, wearMode: string): number {
  const rarityEnum = rarity.toUpperCase() as EquipmentRarity;
  const wearModeEnum = wearMode.toUpperCase() as WearMode;

  if (wearModeEnum === WearMode.PER_ROLL) {
    return DURABILITY_MAX_PER_ROLL[rarityEnum] || DURABILITY_MAX_PER_ROLL[EquipmentRarity.COMMON];
  } else {
    return DURABILITY_MAX_PER_MATCH[rarityEnum] || DURABILITY_MAX_PER_MATCH[EquipmentRarity.COMMON];
  }
}

/**
 * Определяет режим износа по слоту
 */
export function getWearModeBySlot(slot: string): WearMode {
  const slotUpper = slot.toUpperCase();
  if (slotUpper === EquipmentSlot.DIE_1 || slotUpper === EquipmentSlot.DIE_2) {
    return WearMode.PER_ROLL;
  }
  return WearMode.PER_MATCH;
}

/**
 * Определяет зону износа по текущей прочности
 * @param durabilityCurrent Текущая прочность
 * @param durabilityMax Максимальная прочность
 * @returns 'A' | 'B' | 'C' | 'DESTROYED'
 */
export function getDurabilityZone(
  durabilityCurrent: number | null,
  durabilityMax: number,
): 'A' | 'B' | 'C' | 'DESTROYED' {
  if (durabilityCurrent === null || durabilityCurrent <= 0) {
    return 'DESTROYED';
  }

  const ratio = durabilityCurrent / durabilityMax;

  if (ratio > 0.50) {
    return 'A';
  } else if (ratio > 0.25) {
    return 'B';
  } else {
    return 'C';
  }
}

/**
 * Рассчитывает стоимость ремонта по формуле Equipment Spec
 * @param durabilityMax Максимальная прочность
 * @param durabilityCurrent Текущая прочность
 * @param repairBaseCost Базовая стоимость ремонта
 * @param playerLevel Уровень игрока
 * @returns Стоимость ремонта
 */
export function calculateRepairCost(
  durabilityMax: number,
  durabilityCurrent: number | null,
  repairBaseCost: number,
  playerLevel: number,
): number {
  if (durabilityCurrent === null) {
    durabilityCurrent = durabilityMax;
  }

  if (durabilityCurrent >= durabilityMax) {
    return 0;
  }

  // missing = durability_max - durability_current
  const missing = durabilityMax - durabilityCurrent;

  // missing_ratio = missing / durability_max
  const missingRatio = missing / durabilityMax;

  // repair_cost = repair_base_cost * missing_ratio * (1 + 0.01 * player_level)
  let repairCost = repairBaseCost * missingRatio * (1 + 0.01 * playerLevel);

  // Определяем зону износа и применяем множитель
  const zone = getDurabilityZone(durabilityCurrent, durabilityMax);
  if (zone !== 'DESTROYED') {
    const zoneMult = REPAIR_ZONE_MULTIPLIERS[zone];
    repairCost *= zoneMult;
  }

  return Math.floor(repairCost);
}

/**
 * Применяет износ к предмету
 * @param durabilityCurrent Текущая прочность
 * @param durabilityMax Максимальная прочность
 * @param wearAmount Количество износа
 * @param isTournament Является ли это турниром
 * @param tournamentWearMult Множитель износа в турнирах
 * @returns Новая прочность (0 или меньше = уничтожен)
 */
export function applyWear(
  durabilityCurrent: number | null,
  durabilityMax: number,
  wearAmount: number,
  isTournament: boolean = false,
  tournamentWearMult: number = 2.0,
): number {
  if (durabilityCurrent === null) {
    durabilityCurrent = durabilityMax;
  }

  let actualWearAmount = wearAmount;
  if (isTournament) {
    actualWearAmount = wearAmount * tournamentWearMult;
  }

  const newDurability = durabilityCurrent - actualWearAmount;
  return Math.max(0, newDurability); // Не может быть меньше 0
}

/**
 * Преобразует старый type в новый slot
 */
export function typeToSlot(type: string): EquipmentSlot {
  const typeLower = type.toLowerCase();
  switch (typeLower) {
    case 'board':
      return EquipmentSlot.BOARD;
    case 'dice':
      return EquipmentSlot.DIE_1; // Для совместимости, но нужно указывать DIE_1 или DIE_2
    case 'checkers':
      return EquipmentSlot.CHECKERS;
    default:
      return EquipmentSlot.BOARD;
  }
}

