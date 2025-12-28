import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { Building } from './building.entity';
import { BuildingConfig } from './building-config.entity';
import { CityService } from './city.service';

@Injectable()
export class CityAutobuildService {
  private readonly logger = new Logger(CityAutobuildService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
    @InjectRepository(BuildingConfig)
    private buildingConfigsRepository: Repository<BuildingConfig>,
    private cityService: CityService,
  ) {}

  /**
   * Автоматический сбор дохода для всех пользователей с автобилдом
   * Запускается каждый час
   */
  @Cron('0 * * * *') // Каждый час в начале часа
  async collectIncomeForAllUsers() {
    this.logger.log('Запуск автоматического сбора дохода для всех пользователей...');

    try {
      const usersWithAutobuild = await this.usersRepository.find({
        where: { hasCityAutobuild: true },
      });

      this.logger.log(`Найдено ${usersWithAutobuild.length} пользователей с автобилдом для сбора дохода`);

      for (const user of usersWithAutobuild) {
        try {
          await this.collectAllIncome(user.id);
        } catch (error) {
          this.logger.error(`Ошибка сбора дохода для пользователя ${user.id}:`, error);
        }
      }

      this.logger.log('Автоматический сбор дохода завершен');
    } catch (error) {
      this.logger.error('Ошибка при автоматическом сборе дохода:', error);
    }
  }

  /**
   * Автоматический билд города для всех пользователей с автобилдом
   * Запускается каждые 5 минут
   */
  @Cron('*/5 * * * *') // Каждые 5 минут
  async runAutobuildForAllUsers() {
    this.logger.log('Запуск автобилда для всех пользователей...');

    try {
      // Получаем всех пользователей с активным автобилдом
      const usersWithAutobuild = await this.usersRepository.find({
        where: { hasCityAutobuild: true },
      });

      this.logger.log(`Найдено ${usersWithAutobuild.length} пользователей с автобилдом`);

      for (const user of usersWithAutobuild) {
        try {
          await this.runAutobuildForUser(user.id);
        } catch (error) {
          this.logger.error(`Ошибка автобилда для пользователя ${user.id}:`, error);
        }
      }

      this.logger.log('Автобилд завершен для всех пользователей');
    } catch (error) {
      this.logger.error('Ошибка при выполнении автобилда:', error);
    }
  }

  /**
   * Выполнить автобилд для конкретного пользователя
   */
  async runAutobuildForUser(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user || !user.hasCityAutobuild) {
      return;
    }

    // Сначала собираем накопленный доход со всех строений
    await this.collectAllIncome(userId);

    const minBalance = Number(user.autobuildMinBalance || 0);
    const strategy = user.autobuildStrategy || 'balanced';
    const priorityBuilding = user.autobuildPriorityBuilding;

    // Обновляем данные пользователя после сбора дохода
    const updatedUser = await this.usersRepository.findOne({ where: { id: userId } });
    if (!updatedUser) return;

    // Получаем текущий баланс пользователя
    const currentBalance = Number(updatedUser.narCoin);
    const availableBalance = currentBalance - minBalance;

    if (availableBalance <= 0) {
      this.logger.debug(`Пользователь ${userId}: недостаточно средств (баланс: ${currentBalance}, минимум: ${minBalance})`);
      return;
    }

    // Получаем все доступные конфигурации строений
    const allConfigs = await this.buildingConfigsRepository.find();
    if (allConfigs.length === 0) {
      return;
    }

    // Получаем все строения пользователя (после обновления баланса)
    const userBuildings = await this.buildingsRepository.find({
      where: { userId },
    });

    let spent = 0;
    let actionsPerformed = 0;
    const maxActions = 10; // Максимум действий за один запуск

    // Стратегия 1: Покупка новых строений
    for (const config of allConfigs) {
      if (actionsPerformed >= maxActions) break;

      // Проверяем, есть ли у пользователя строение этого типа
      const hasBuilding = userBuildings.some(b => b.type === config.type);

      if (!hasBuilding) {
        // Покупаем новое строение
        const price = Number(config.basePrice);
        if (spent + price <= availableBalance) {
          try {
            await this.cityService.purchaseBuilding(userId, config.id);
            spent += price;
            actionsPerformed++;
            this.logger.debug(`Пользователь ${userId}: куплено строение ${config.name} за ${price} NAR`);
            
            // Обновляем баланс пользователя и список строений
            const updatedUser = await this.usersRepository.findOne({ where: { id: userId } });
            if (updatedUser) {
              user.narCoin = updatedUser.narCoin;
              // Перезагружаем строения пользователя
              const updatedBuildings = await this.buildingsRepository.find({
                where: { userId },
              });
              userBuildings.push(...updatedBuildings.filter(b => !userBuildings.some(ub => ub.id === b.id)));
            }
          } catch (error) {
            // Игнорируем ошибки (недостаточно средств и т.д.)
            this.logger.debug(`Не удалось купить строение ${config.name}: ${error.message}`);
          }
        }
      }
    }

    // Стратегия 2: Улучшение существующих строений
    if (strategy === 'balanced') {
      // Равномерное улучшение всех строений
      await this.upgradeBuildingsBalanced(userId, availableBalance - spent, maxActions - actionsPerformed);
    } else if (strategy === 'priority' && priorityBuilding) {
      // Приоритетное улучшение одного строения
      await this.upgradeBuildingPriority(userId, priorityBuilding, availableBalance - spent, maxActions - actionsPerformed);
    }
  }

  /**
   * Автоматический сбор дохода со всех строений пользователя
   */
  private async collectAllIncome(userId: string): Promise<void> {
    try {
      const userBuildings = await this.buildingsRepository.find({
        where: { userId },
      });

      if (userBuildings.length === 0) {
        return;
      }

      let totalCollected = 0;

      for (const building of userBuildings) {
        try {
          // Проверяем, есть ли накопленный доход
          const now = new Date();
          const lastCollection = building.lastIncomeCollection || building.createdAt;
          const hoursPassed = (now.getTime() - lastCollection.getTime()) / (1000 * 60 * 60);

          // Если прошло меньше часа, пропускаем
          if (hoursPassed < 1) {
            continue;
          }

          // Собираем доход через CityService
          const result = await this.cityService.collectIncome(userId, building.id);
          totalCollected += result.collected;
          this.logger.debug(`Пользователь ${userId}: собрано ${result.collected} NAR со строения ${building.type}`);
        } catch (error: any) {
          // Игнорируем ошибки сбора (строение может быть удалено и т.д.)
          this.logger.debug(`Не удалось собрать доход со строения ${building.id}: ${error.message}`);
        }
      }

      if (totalCollected > 0) {
        this.logger.log(`Пользователь ${userId}: всего собрано ${totalCollected} NAR со всех строений`);
      }
    } catch (error) {
      this.logger.error(`Ошибка при сборе дохода для пользователя ${userId}:`, error);
    }
  }

  /**
   * Равномерное улучшение всех строений
   */
  private async upgradeBuildingsBalanced(
    userId: string,
    availableBalance: number,
    maxActions: number,
  ): Promise<void> {
    // Получаем актуальные данные пользователя
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) return;

    const minBalance = Number(user.autobuildMinBalance || 0);
    let currentBalance = Number(user.narCoin);
    let actualAvailableBalance = Math.min(availableBalance, currentBalance - minBalance);

    if (actualAvailableBalance <= 0) {
      return;
    }

    const userBuildings = await this.buildingsRepository.find({
      where: { userId },
    });

    if (userBuildings.length === 0) {
      return;
    }

    // Получаем конфигурации для расчета цен
    const configs = await this.buildingConfigsRepository.find();
    const configMap = new Map(configs.map(c => [c.type, c]));

    let spent = 0;
    let actionsPerformed = 0;

    // Сортируем строения по уровню (сначала улучшаем самые слабые)
    const sortedBuildings = [...userBuildings].sort((a, b) => a.level - b.level);

    // Улучшаем строения по кругу, пока есть средства
    while (spent < actualAvailableBalance && actionsPerformed < maxActions) {
      let upgraded = false;

      for (const building of sortedBuildings) {
        if (actionsPerformed >= maxActions) break;

        // Получаем актуальные данные строения
        const freshBuilding = await this.buildingsRepository.findOne({
          where: { id: building.id },
        });
        if (!freshBuilding) continue;

        const config = configMap.get(freshBuilding.type);
        if (!config || freshBuilding.level >= config.maxLevel) {
          continue; // Пропускаем строения на максимальном уровне
        }

        // Рассчитываем цену улучшения: basePrice * upgradeMultiplier^level
        const multiplier = config.upgradeMultiplier || 1.15;
        const upgradePrice = Math.floor(Number(config.basePrice) * Math.pow(multiplier, freshBuilding.level));

        // Проверяем баланс снова
        const updatedUser = await this.usersRepository.findOne({ where: { id: userId } });
        if (!updatedUser) break;
        currentBalance = Number(updatedUser.narCoin);
        actualAvailableBalance = currentBalance - minBalance;

        if (spent + upgradePrice <= actualAvailableBalance) {
          try {
            await this.cityService.upgradeBuilding(userId, freshBuilding.id);
            spent += upgradePrice;
            actionsPerformed++;
            upgraded = true;
            this.logger.debug(`Пользователь ${userId}: улучшено строение ${freshBuilding.type} до уровня ${freshBuilding.level + 1} за ${upgradePrice} NAR`);

            // Обновляем уровень строения в локальной копии
            building.level = freshBuilding.level + 1;
          } catch (error: any) {
            this.logger.debug(`Не удалось улучшить строение ${freshBuilding.type}: ${error.message}`);
          }
        }
      }

      // Если ни одно строение не было улучшено, выходим
      if (!upgraded) {
        break;
      }
    }
  }

  /**
   * Приоритетное улучшение одного строения
   */
  private async upgradeBuildingPriority(
    userId: string,
    priorityType: string,
    availableBalance: number,
    maxActions: number,
  ): Promise<void> {
    // Получаем актуальные данные пользователя
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) return;

    const minBalance = Number(user.autobuildMinBalance || 0);
    let currentBalance = Number(user.narCoin);
    let actualAvailableBalance = Math.min(availableBalance, currentBalance - minBalance);

    if (actualAvailableBalance <= 0) {
      return;
    }

    const priorityBuildings = await this.buildingsRepository.find({
      where: { userId, type: priorityType },
    });

    if (priorityBuildings.length === 0) {
      return;
    }

    const config = await this.buildingConfigsRepository.findOne({
      where: { type: priorityType },
    });

    if (!config) {
      return;
    }

    let spent = 0;
    let actionsPerformed = 0;

    // Улучшаем все строения приоритетного типа
    for (const building of priorityBuildings) {
      if (spent >= actualAvailableBalance || actionsPerformed >= maxActions) {
        break;
      }

      // Получаем актуальные данные строения
      const freshBuilding = await this.buildingsRepository.findOne({
        where: { id: building.id },
      });
      if (!freshBuilding) continue;

      if (freshBuilding.level >= config.maxLevel) {
        continue;
      }

      const multiplier = config.upgradeMultiplier || 1.15;
      const upgradePrice = Math.floor(Number(config.basePrice) * Math.pow(multiplier, freshBuilding.level));

      // Проверяем баланс снова
      const updatedUser = await this.usersRepository.findOne({ where: { id: userId } });
      if (!updatedUser) break;
      currentBalance = Number(updatedUser.narCoin);
      actualAvailableBalance = currentBalance - minBalance;

      if (spent + upgradePrice <= actualAvailableBalance) {
        try {
          await this.cityService.upgradeBuilding(userId, freshBuilding.id);
          spent += upgradePrice;
          actionsPerformed++;
          this.logger.debug(`Пользователь ${userId}: улучшено приоритетное строение ${freshBuilding.type} до уровня ${freshBuilding.level + 1} за ${upgradePrice} NAR`);
        } catch (error: any) {
          this.logger.debug(`Не удалось улучшить приоритетное строение: ${error.message}`);
        }
      }
    }
  }
}

