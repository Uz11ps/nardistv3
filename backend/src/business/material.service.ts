import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Material, MaterialType, MaterialSort } from './material.entity';
import { PlayerMaterial } from './player-material.entity';
import { MaterialPackage } from './business.entity';
import { DistrictName } from './district.entity';

@Injectable()
export class MaterialService {
  private readonly logger = new Logger(MaterialService.name);

  // Пропорции материалов в пакетах (в процентах)
  private readonly MATERIAL_PACKAGE_PROPS: Record<MaterialPackage, Array<{ type: MaterialType; percent: number }>> = {
    [MaterialPackage.WOOD_LACQUER]: [
      { type: MaterialType.WOOD, percent: 60 },
      { type: MaterialType.LACQUER, percent: 40 },
    ],
    [MaterialPackage.FABRIC]: [
      { type: MaterialType.FABRIC, percent: 100 },
    ],
    [MaterialPackage.WOOD_LACQUER_METAL]: [
      { type: MaterialType.WOOD, percent: 60 },
      { type: MaterialType.LACQUER, percent: 30 },
      { type: MaterialType.METAL, percent: 10 },
    ],
    [MaterialPackage.STONE_RESIN]: [
      { type: MaterialType.STONE, percent: 55 },
      { type: MaterialType.RESIN, percent: 45 },
    ],
    [MaterialPackage.WOOD_METAL]: [
      { type: MaterialType.WOOD, percent: 70 },
      { type: MaterialType.METAL, percent: 30 },
    ],
    [MaterialPackage.SERVICE]: [],
    [MaterialPackage.LEATHER_FABRIC_METAL]: [
      { type: MaterialType.LEATHER, percent: 55 },
      { type: MaterialType.FABRIC, percent: 40 },
      { type: MaterialType.METAL, percent: 5 },
    ],
    [MaterialPackage.LACQUER_MECHANICS]: [
      { type: MaterialType.LACQUER, percent: 50 },
      { type: MaterialType.MECHANICS, percent: 50 },
    ],
    [MaterialPackage.METAL]: [
      { type: MaterialType.METAL, percent: 100 },
    ],
    [MaterialPackage.LEATHER]: [
      { type: MaterialType.LEATHER, percent: 100 },
    ],
    [MaterialPackage.STONE]: [
      { type: MaterialType.STONE, percent: 100 },
    ],
  };

  // Распределение типов материалов по районам
  private readonly DISTRICT_MATERIALS: Record<DistrictName, Array<{ type: MaterialType; percent: number }>> = {
    [DistrictName.COURTYARDS]: [
      { type: MaterialType.FABRIC, percent: 55 },
      { type: MaterialType.WOOD, percent: 30 },
      { type: MaterialType.LACQUER, percent: 15 },
    ],
    [DistrictName.MASTERS_QUARTER]: [
      { type: MaterialType.WOOD, percent: 55 },
      { type: MaterialType.RESIN, percent: 30 },
      { type: MaterialType.METAL, percent: 15 },
    ],
    [DistrictName.TRADE_GALLERY]: [
      { type: MaterialType.LACQUER, percent: 55 },
      { type: MaterialType.MECHANICS, percent: 30 },
      { type: MaterialType.FABRIC, percent: 15 },
    ],
    [DistrictName.ACADEMY]: [
      { type: MaterialType.LACQUER, percent: 55 },
      { type: MaterialType.FABRIC, percent: 30 },
      { type: MaterialType.MECHANICS, percent: 15 },
    ],
    [DistrictName.CLUB_PROSPECT]: [
      { type: MaterialType.MECHANICS, percent: 55 },
      { type: MaterialType.LACQUER, percent: 30 },
      { type: MaterialType.METAL, percent: 15 },
    ],
    [DistrictName.CATHEDRAL_SQUARE]: [
      { type: MaterialType.MECHANICS, percent: 55 },
      { type: MaterialType.METAL, percent: 45 },
    ],
    [DistrictName.SUPPLY_PIER]: [
      { type: MaterialType.METAL, percent: 55 },
      { type: MaterialType.LEATHER, percent: 30 },
      { type: MaterialType.STONE, percent: 15 },
    ],
  };

  constructor(
    @InjectRepository(Material)
    private materialRepository: Repository<Material>,
    @InjectRepository(PlayerMaterial)
    private playerMaterialRepository: Repository<PlayerMaterial>,
  ) {}

  /**
   * Получить все материалы игрока
   */
  async getPlayerMaterials(playerId: string): Promise<PlayerMaterial[]> {
    return this.playerMaterialRepository.find({
      where: { playerId },
      relations: ['material'],
    });
  }

  /**
   * Добавить материалы из бизнеса
   */
  async addMaterialsFromBusiness(
    playerId: string,
    materialPackage: MaterialPackage,
    totalAmount: number,
  ): Promise<void> {
    const props = this.MATERIAL_PACKAGE_PROPS[materialPackage];
    if (!props || props.length === 0) {
      return; // Сервисные бизнесы не дают материалов
    }

    for (const prop of props) {
      const amount = Math.floor((totalAmount * prop.percent) / 100);
      if (amount > 0) {
        // Добавляем материалы сорта 1 (базовые)
        await this.addMaterial(playerId, prop.type, MaterialSort.S1, amount);
      }
    }
  }

  /**
   * Добавить материал игроку
   */
  async addMaterial(playerId: string, type: MaterialType, sort: MaterialSort, quantity: number): Promise<void> {
    const material = await this.materialRepository.findOne({ where: { type, sort } });
    if (!material) {
      this.logger.warn(`Материал не найден: ${type}, ${sort}`);
      return;
    }

    let playerMaterial = await this.playerMaterialRepository.findOne({
      where: { playerId, materialId: material.id },
    });

    if (playerMaterial) {
      playerMaterial.quantity += quantity;
    } else {
      playerMaterial = this.playerMaterialRepository.create({
        playerId,
        materialId: material.id,
        quantity,
      });
    }

    await this.playerMaterialRepository.save(playerMaterial);
  }

  /**
   * Проверить, достаточно ли материалов у игрока
   */
  async hasEnoughMaterials(
    playerId: string,
    materialPackage: MaterialPackage,
    totalRequired: number,
    allowedSorts: MaterialSort[],
  ): Promise<boolean> {
    const props = this.MATERIAL_PACKAGE_PROPS[materialPackage];
    if (!props || props.length === 0) {
      return true; // Сервисные пакеты не требуют материалов
    }

    // Получаем все материалы игрока нужных типов и сортов
    const materials = await this.materialRepository.find({
      where: {
        type: In(props.map(p => p.type)),
        sort: In(allowedSorts),
      },
    });

    const playerMaterials = await this.playerMaterialRepository.find({
      where: {
        playerId,
        materialId: In(materials.map(m => m.id)),
      },
      relations: ['material'],
    });

    // Проверяем, достаточно ли материалов по каждому типу
    for (const prop of props) {
      const required = Math.floor((totalRequired * prop.percent) / 100);
      const available = playerMaterials
        .filter(pm => pm.material.type === prop.type && allowedSorts.includes(pm.material.sort))
        .reduce((sum, pm) => sum + pm.quantity, 0);

      if (available < required) {
        return false;
      }
    }

    return true;
  }

  /**
   * Потратить материалы
   */
  async spendMaterials(
    playerId: string,
    materialPackage: MaterialPackage,
    totalAmount: number,
    allowedSorts: MaterialSort[],
  ): Promise<void> {
    const props = this.MATERIAL_PACKAGE_PROPS[materialPackage];
    if (!props || props.length === 0) {
      return;
    }

    const materials = await this.materialRepository.find({
      where: {
        type: In(props.map(p => p.type)),
        sort: In(allowedSorts),
      },
    });

    const playerMaterials = await this.playerMaterialRepository.find({
      where: {
        playerId,
        materialId: In(materials.map(m => m.id)),
      },
      relations: ['material'],
    });

    for (const prop of props) {
      const required = Math.floor((totalAmount * prop.percent) / 100);
      let remaining = required;

      // Сначала тратим материалы высших сортов
      const sortedSorts = [...allowedSorts].sort((a, b) => b - a);

      for (const sort of sortedSorts) {
        if (remaining <= 0) break;

        const playerMaterial = playerMaterials.find(
          pm => pm.material.type === prop.type && pm.material.sort === sort,
        );

        if (playerMaterial && playerMaterial.quantity > 0) {
          const toSpend = Math.min(remaining, playerMaterial.quantity);
          playerMaterial.quantity -= toSpend;
          remaining -= toSpend;

          if (playerMaterial.quantity === 0) {
            await this.playerMaterialRepository.remove(playerMaterial);
          } else {
            await this.playerMaterialRepository.save(playerMaterial);
          }
        }
      }

      if (remaining > 0) {
        throw new Error(`Недостаточно материалов типа ${prop.type}`);
      }
    }
  }

  /**
   * Генерировать дроп материалов из матча
   */
  async generateMatchDrop(
    playerId: string,
    isWinner: boolean,
    stake: number,
    district: DistrictName,
  ): Promise<{ materials: Array<{ type: MaterialType; sort: MaterialSort; quantity: number }> }> {
    // Импортируем конфигурацию дропа
    const { MATERIAL_DROP_CONFIG } = await import('./business-economy.config');
    
    // Находим конфигурацию для ставки (берем ближайшую меньшую или равную)
    const configs = MATERIAL_DROP_CONFIG.filter(c => c.stake <= stake).sort((a, b) => b.stake - a.stake);
    const config = configs[0];
    if (!config) {
      return { materials: [] };
    }

    const chance = isWinner ? config.winnerChance : config.loserChance;
    const amountConfig = isWinner ? config.winnerAmount : config.loserAmount;
    const sortsConfig = isWinner ? config.winnerSorts : config.loserSorts;

    // Проверяем, выпал ли дроп
    if (Math.random() * 100 > chance) {
      return { materials: [] };
    }

    // Определяем количество материалов
    const amount = this.getRandomAmount(amountConfig.min, amountConfig.max, amountConfig.weights);

    // Определяем тип материала по району
    const districtMaterials = this.DISTRICT_MATERIALS[district];
    const materialType = this.selectMaterialType(districtMaterials);

    // Определяем сорт материала
    const sort = this.selectMaterialSort(sortsConfig);

    // Добавляем материалы игроку
    await this.addMaterial(playerId, materialType, sort, amount);

    return {
      materials: [{ type: materialType, sort, quantity: amount }],
    };
  }

  /**
   * Выбрать случайное количество материалов
   */
  private getRandomAmount(min: number, max: number, weights: number[]): number {
    if (min === max) return min;
    const random = Math.random() * 100;
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return min + i;
      }
    }
    return max;
  }

  /**
   * Выбрать тип материала по району
   */
  private selectMaterialType(districtMaterials: Array<{ type: MaterialType; percent: number }>): MaterialType {
    const random = Math.random() * 100;
    let cumulative = 0;
    for (const mat of districtMaterials) {
      cumulative += mat.percent;
      if (random <= cumulative) {
        return mat.type;
      }
    }
    return districtMaterials[0].type;
  }

  /**
   * Выбрать сорт материала
   */
  private selectMaterialSort(sorts: { s1: number; s2: number; s3: number; s4: number }): MaterialSort {
    const random = Math.random() * 100;
    if (random <= sorts.s1) return MaterialSort.S1;
    if (random <= sorts.s1 + sorts.s2) return MaterialSort.S2;
    if (random <= sorts.s1 + sorts.s2 + sorts.s3) return MaterialSort.S3;
    return MaterialSort.S4;
  }
}

