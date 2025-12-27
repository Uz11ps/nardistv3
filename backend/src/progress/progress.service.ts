import { Injectable, Inject, forwardRef, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Enhancement, EnhancementType } from './enhancement.entity';
import { UserPurchase, PurchaseType } from './user-purchase.entity';
import { CityTreasury } from './city-treasury.entity';
import { UserRewardDebt } from './user-reward-debt.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { GameType } from '../games/game.entity';
import { XpCalculatorService } from './xp-calculator.service';
import { ProgressionBranchesService } from './progression-branches.service';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);
  private readonly MAX_LEVEL = 50;
  
  constructor(
    private usersService: UsersService,
    private xpCalculator: XpCalculatorService,
    private branchesService: ProgressionBranchesService,
    @InjectRepository(Enhancement)
    private enhancementRepository: Repository<Enhancement>,
    @InjectRepository(UserPurchase)
    private userPurchaseRepository: Repository<UserPurchase>,
    @InjectRepository(CityTreasury)
    private cityTreasuryRepository: Repository<CityTreasury>,
    @InjectRepository(UserRewardDebt)
    private userRewardDebtRepository: Repository<UserRewardDebt>,
  ) {}

  /**
   * Возвращает текущую конфигурацию прогрессии
   */
  getProgressionConfig() {
    return this.branchesService.getConfig();
  }

  // Используем новый калькулятор XP
  private getLevelFromTotalXP(totalXP: number): number {
    return this.xpCalculator.getLevelFromTotalXP(totalXP);
  }
  
  private getTotalXPForLevel(level: number): number {
    return this.xpCalculator.getTotalXPForLevel(level);
  }

  async getLevelProgress(userId: string): Promise<{ currentLevel: number; currentXP: number; xpForCurrentLevel: number; xpForNextLevel: number; xpNeededForNextLevel: number; progress: number }> {
    const user = await this.usersService.findOne(userId);
    const currentXP = Number(user.xp || 0);
    const currentLevel = this.getLevelFromTotalXP(currentXP);
    const xpForCurrentLevel = currentLevel <= 1 ? 0 : this.getTotalXPForLevel(currentLevel);
    const xpForNextLevel = currentLevel >= this.MAX_LEVEL ? xpForCurrentLevel : this.getTotalXPForLevel(currentLevel + 1);
    const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
    const xpProgress = currentXP - xpForCurrentLevel;
    const progress = currentLevel >= this.MAX_LEVEL ? 1 : Math.max(0, Math.min(1, xpProgress / xpNeededForNextLevel));
    
    return {
      currentLevel,
      currentXP,
      xpForCurrentLevel,
      xpForNextLevel,
      xpNeededForNextLevel,
      progress,
    };
  }
  
  private readonly ENERGY_RESTORE_INTERVAL = 30 * 60 * 1000; // 30 минут
  private readonly ENERGY_RESTORE_AMOUNT = 10; // 10 энергии за восстановление
  private readonly LIFE_RESTORE_INTERVAL = 4 * 60 * 60 * 1000; // 4 часа
  private readonly LIFE_RESTORE_AMOUNT = 1; // 1 жизнь за восстановление
  private readonly BASE_LIVES_LOSS = 1; // Базовая потеря жизней при поражении
  
  // Расход энергии согласно таблице 9 спецификации
  private readonly ENERGY_COST_WIN = 5; // Победа в боевом матче
  private readonly ENERGY_COST_LOSS = 10; // Поражение в боевом матче
  private readonly ENERGY_COST_TOURNAMENT = 15; // Турнирный матч (участие)

  constructor(
    @InjectRepository(Enhancement)
    private enhancementsRepository: Repository<Enhancement>,
    @InjectRepository(UserPurchase)
    private purchasesRepository: Repository<UserPurchase>,
    @InjectRepository(CityTreasury)
    private treasuryRepository: Repository<CityTreasury>,
    @InjectRepository(UserRewardDebt)
    private rewardDebtRepository: Repository<UserRewardDebt>,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private xpCalculator: XpCalculatorService,
    private branchesService: ProgressionBranchesService,
  ) {}

  /**
   * Возвращает текущую конфигурацию прогрессии
   */
  getProgressionConfig() {
    return this.branchesService.getConfig();
  }

  async addXP(userId: string, amount: number): Promise<{ levelUp: boolean; newLevel?: number; previousLevel?: number; skillPointsGained?: number }> {
    const user = await this.usersService.findOne(userId);
    
    // Используем реальный XP из базы данных (общий накопленный XP)
    let currentXP = Number(user.xp || 0);
    
    // Если уровень уже максимальный, не добавляем XP
    const currentLevel = this.getLevelFromTotalXP(currentXP);
    if (currentLevel >= this.MAX_LEVEL) {
      return { levelUp: false };
    }
    
    // Сохраняем предыдущий уровень
    const previousLevel = currentLevel;
    
    // Добавляем полученный XP
    currentXP += amount;
    
    // Вычисляем новый уровень на основе общего XP
    const newLevel = this.getLevelFromTotalXP(currentXP);
    
    const levelUp = newLevel > previousLevel;
    
    let skillPointsGained = 0;
    
    // Если уровень повысился, начисляем Skill Points и награду
    if (levelUp) {
      // Начисляем SP за каждый новый уровень
      for (let level = previousLevel + 1; level <= newLevel; level++) {
        const spForLevel = this.getSkillPointsForLevel(level);
        skillPointsGained += spForLevel;
      }
      
      // Обновляем SP пользователя
      user.skillPoints = (user.skillPoints || 0) + skillPointsGained;
      user.freeSkillPoints = (user.freeSkillPoints || 0) + skillPointsGained;
      
      // Выплачиваем награды за каждый новый уровень
      for (let level = previousLevel + 1; level <= newLevel; level++) {
        await this.payLevelReward(userId, level);
      }
      
      // Проверяем лицензию предпринимателя на уровне 5
      if (newLevel >= 5 && !user.hasBusinessLicense) {
        // Можно показать уведомление о необходимости покупки лицензии
      }
    }
    
    // Обновляем уровень и XP
    user.level = newLevel;
    user.xp = BigInt(currentXP);
    
    // Применяем характеристики веток прокачки
    await this.applyBranchStats(userId);
    
    await this.usersService['usersRepository'].save(user);
    
    return { levelUp, newLevel, previousLevel, skillPointsGained };
  }

  /**
   * Распределить Skill Points по веткам прогрессии
   */
  async distributeSkillPoints(userId: string, type: EnhancementType, amount: number): Promise<void> {
    const user = await this.usersService.findOne(userId);
    
    if ((user.freeSkillPoints || 0) < amount) {
      throw new BadRequestException(`Недостаточно свободных Skill Points. Доступно: ${user.freeSkillPoints || 0}, требуется: ${amount}`);
    }
    
    // Распределяем SP по веткам
    switch (type) {
      case EnhancementType.ECONOMY:
        user.economySp = (user.economySp || 0) + amount;
        break;
      case EnhancementType.ENERGY:
        user.energySp = (user.energySp || 0) + amount;
        break;
      case EnhancementType.LIVES:
        user.livesSp = (user.livesSp || 0) + amount;
        break;
      case EnhancementType.POWER:
        user.powerSp = (user.powerSp || 0) + amount;
        break;
      default:
        throw new BadRequestException(`Неизвестный тип усиления: ${type}`);
    }
    
    user.freeSkillPoints = (user.freeSkillPoints || 0) - amount;
    await this.usersService['usersRepository'].save(user);
    
    this.logger.log(`✅ Распределено ${amount} SP в ветку ${type} для пользователя ${userId}`);
  }

  /**
   * Получить количество Skill Points за уровень
   * Уровни 2-5: +1 SP, уровни 6-50: +2 SP
   */
  private getSkillPointsForLevel(level: number): number {
    const config = this.branchesService.getConfig().skillPoints;
    if (level >= 2 && level <= 5) {
      return config.levels2To5;
    } else if (level >= 6 && level <= 50) {
      return config.levels6To50;
    }
    return 0;
  }

  /**
   * Выплатить награду за уровень из казны города
   */
  private async payLevelReward(userId: string, level: number): Promise<void> {
    // Получаем или создаем казну города
    let treasury = await this.treasuryRepository.findOne({ where: {} });
    if (!treasury) {
      treasury = this.treasuryRepository.create({
        balance: BigInt(0),
        totalCollected: BigInt(0),
        totalPaid: BigInt(0),
      });
      await this.treasuryRepository.save(treasury);
    }
    
    // Получаем награду за уровень (из конфига или таблицы)
    const reward = this.getLevelRewardNAR(level);
    
    // Выплачиваем из казны
    const user = await this.usersService.findOne(userId);
    const treasuryBalance = Number(treasury.balance);
    const pay = Math.min(treasuryBalance, reward);
    
    if (pay > 0) {
      // Выплачиваем доступную часть
      treasury.balance = BigInt(treasuryBalance - pay);
      treasury.totalPaid = BigInt(Number(treasury.totalPaid) + pay);
      await this.treasuryRepository.save(treasury);
      
      user.narCoin = BigInt(Number(user.narCoin) + pay);
      await this.usersService['usersRepository'].save(user);
    }
    
    // Если казны не хватило, создаем задолженность
    const debt = reward - pay;
    if (debt > 0) {
      const rewardDebt = this.rewardDebtRepository.create({
        userId,
        amount: BigInt(debt),
        level,
        paid: false,
      });
      await this.rewardDebtRepository.save(rewardDebt);
    }
  }

  /**
   * Получить награду NAR за уровень
   */
  private getLevelRewardNAR(level: number): number {
    const config = this.branchesService.getConfig();
    
    // Используем таблицу наград за уровень, если она есть
    if (config.levelRewards && config.levelRewards[level]) {
      return config.levelRewards[level];
    }
    
    // Но на уровне 5 должна быть спец награда 10000 для лицензии
    if (level === 5) {
      const licenseConfig = config.license;
      return licenseConfig.costNar;
    }
    
    // Фолбэк на порог XP или дефолт
    const xpThresholds = config.xp?.thresholds;
    if (xpThresholds && xpThresholds[level]) {
      return Math.floor(xpThresholds[level] / 10); // Условная награда от порога XP
    }
    
    return 1000;
  }

  /**
   * Применить характеристики веток прокачки к пользователю
   */
  private async applyBranchStats(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    
    // Рассчитываем характеристики по формулам
    const stats = this.branchesService.calculateAllStats({
      econSp: user.economySp || 0,
      energySp: user.energySp || 0,
      livesSp: user.livesSp || 0,
      powerSp: user.powerSp || 0,
    });
    
    // Обновляем максимумы энергии и жизней
    user.maxEnergy = stats.energy.max;
    user.maxLives = stats.lives.max;
    
    // Обновляем текущие значения, если они превышают новые максимумы
    if (user.energy > user.maxEnergy) {
      user.energy = user.maxEnergy;
    }
    if (user.lives > user.maxLives) {
      user.lives = user.maxLives;
    }
    
    await this.usersService['usersRepository'].save(user);
  }

  async addNarCoin(userId: string, amount: number): Promise<void> {
    const user = await this.usersService.findOne(userId);
    user.narCoin = BigInt(user.narCoin || 0) + BigInt(amount);
    await this.usersService['usersRepository'].save(user);
  }

  /**
   * Выбрать усиление при апгрейде уровня
   * Можно выбрать только если уровень увеличился и еще не выбрано усиление для этого уровня
   */
  async chooseEnhancement(userId: string, type: EnhancementType): Promise<void> {
    const user = await this.usersService.findOne(userId);
    const currentLevel = user.level;
    
    // Проверяем, есть ли неиспользованные апгрейды уровня
    // Пользователь может выбрать усиление только если его уровень больше количества выбранных усилений
    const allEnhancements = await this.enhancementsRepository.find({ where: { userId } });
    const totalEnhancementLevels = allEnhancements.reduce((sum, enh) => sum + enh.level, 0);
    
    // Уровень 1 не дает усиления, поэтому начинаем с уровня 2
    // Каждый уровень (начиная со 2-го) дает возможность выбрать усиление
    const availableEnhancements = Math.max(0, currentLevel - 1);
    
    if (totalEnhancementLevels >= availableEnhancements) {
      throw new BadRequestException('Вы уже использовали все доступные усиления для вашего уровня');
    }
    
    // Проверяем, что пользователь действительно повысил уровень
    if (currentLevel <= 1) {
      throw new BadRequestException('Необходимо достичь уровня 2 для выбора усиления');
    }

    const existing = await this.enhancementsRepository.findOne({
      where: { userId, type },
    });

    if (existing) {
      existing.level++;
      await this.enhancementsRepository.save(existing);
    } else {
      const enhancement = this.enhancementsRepository.create({
        userId,
        type,
        level: 1,
      });
      await this.enhancementsRepository.save(enhancement);
    }

    // Обновляем активное усиление пользователя
    user.enhancement = type;
    await this.usersService['usersRepository'].save(user);
  }

  /**
   * Проверить, доступно ли усиление для выбора
   */
  async canChooseEnhancement(userId: string): Promise<{ canChoose: boolean; availableCount: number; usedCount: number }> {
    const user = await this.usersService.findOne(userId);
    const currentLevel = user.level;
    
    const allEnhancements = await this.enhancementsRepository.find({ where: { userId } });
    const totalEnhancementLevels = allEnhancements.reduce((sum, enh) => sum + enh.level, 0);
    
    // Уровень 1 не дает усиления, поэтому начинаем с уровня 2
    const availableEnhancements = Math.max(0, currentLevel - 1);
    const usedCount = totalEnhancementLevels;
    const canChoose = usedCount < availableEnhancements;
    
    return {
      canChoose,
      availableCount: availableEnhancements,
      usedCount,
    };
  }

  async getEnhancements(userId: string): Promise<Enhancement[]> {
    return this.enhancementsRepository.find({ where: { userId } });
  }

  // ========== ПРИМЕНЕНИЕ УСИЛЕНИЙ ==========

  /**
   * Получить уровень усиления пользователя
   */
  async getEnhancementLevel(userId: string, type: EnhancementType): Promise<number> {
    const enhancement = await this.enhancementsRepository.findOne({
      where: { userId, type },
    });
    return enhancement?.level || 0;
  }

  /**
   * ЭКОНОМИКА: Рассчитать комиссию с учетом ветки прокачки
   * Использует новые формулы из спецификации
   */
  calculateFeeWithEconomy(baseFee: number, econSp: number, gearCommissionBonus: number = 0): number {
    const finalCommission = this.branchesService.calculateFinalCommission(econSp, gearCommissionBonus);
    return Math.floor(baseFee * finalCommission);
  }

  /**
   * ЭНЕРГИЯ: Проверить и потратить энергию на игру
   */
  /**
   * Проверка энергии для игры (без траты)
   * Используется перед созданием игры, чтобы убедиться, что энергии достаточно
   * Проверяем максимальный возможный расход (поражение в турнире = 15)
   */
  async checkEnergyForGame(userId: string, gameType: GameType, isTournament: boolean = false): Promise<void> {
    // Бот-игры не тратят энергию
    if (gameType === GameType.VS_BOT) {
      return;
    }

    await this.restoreEnergy(userId); // Сначала восстанавливаем энергию
    
    const user = await this.usersService.findOne(userId);
    
    // Проверяем максимальный возможный расход (поражение в турнире)
    const maxEnergyCost = isTournament ? this.ENERGY_COST_TOURNAMENT : this.ENERGY_COST_LOSS;

    if (user.energy < maxEnergyCost) {
      throw new BadRequestException(`Недостаточно энергии. Требуется минимум: ${maxEnergyCost}, доступно: ${user.energy}`);
    }
  }


  /**
   * ЭНЕРГИЯ: Трата энергии при завершении матча
   * Согласно таблице 9 спецификации:
   * - Победа в боевом матче: -5
   * - Поражение в боевом матче: -10
   * - Турнирный матч (участие): -15
   */
  async consumeEnergyForFinishedGame(
    userId: string,
    gameType: GameType,
    playerWon: boolean,
    isTournament: boolean = false,
  ): Promise<void> {
    // Бот-игры не тратят энергию
    if (gameType === GameType.VS_BOT) {
      return;
    }

    await this.restoreEnergy(userId); // Сначала восстанавливаем энергию
    
    const user = await this.usersService.findOne(userId);
    
    // Определяем расход энергии согласно таблице 9
    let energyCost: number;
    if (isTournament) {
      energyCost = this.ENERGY_COST_TOURNAMENT; // Турнирный матч: -15
    } else if (playerWon) {
      energyCost = this.ENERGY_COST_WIN; // Победа: -5
    } else {
      energyCost = this.ENERGY_COST_LOSS; // Поражение: -10
    }

    // Проверяем наличие энергии
    if (user.energy < energyCost) {
      // Если энергии не хватает, списываем сколько есть (но не меньше 0)
      const actualCost = Math.max(0, user.energy);
      this.logger.warn(`⚠️ У игрока ${userId} недостаточно энергии. Списываем ${actualCost} из требуемых ${energyCost}`);
      energyCost = actualCost;
    }

    if (energyCost > 0) {
      user.energy -= energyCost;
      await this.usersService['usersRepository'].save(user);
    }
  }

  /**
   * ЭНЕРГИЯ: Восстановление энергии со временем
   * Использует новые формулы из спецификации (регенерация в час)
   */
  async restoreEnergy(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    
    // Применяем характеристики веток (обновляем максимум)
    await this.applyBranchStats(userId);
    
    if (user.energy >= user.maxEnergy) {
      return;
    }

    const now = new Date();
    if (!user.lastEnergyRestore) {
      user.lastEnergyRestore = now;
      await this.usersService['usersRepository'].save(user);
      return;
    }

    // Рассчитываем регенерацию в час по формуле
    const regenPerHour = this.branchesService.calculateEnergyRegenPerHour(user.energySp || 0);
    
    // Переводим в интервал восстановления (каждые 30 минут восстанавливаем часть)
    const timePassed = now.getTime() - user.lastEnergyRestore.getTime();
    const hoursPassed = timePassed / (1000 * 60 * 60);
    
    if (hoursPassed > 0) {
      // Восстанавливаем энергию пропорционально прошедшему времени
      const restoreAmount = Math.floor(regenPerHour * hoursPassed);
      
      if (restoreAmount > 0) {
        user.energy = Math.min(user.energy + restoreAmount, user.maxEnergy);
        user.lastEnergyRestore = now;
        await this.usersService['usersRepository'].save(user);
      }
    }
  }

  /**
   * ЖИЗНИ: Проверить наличие жизней
   */
  async checkLives(userId: string): Promise<boolean> {
    await this.restoreLives(userId);
    const user = await this.usersService.findOne(userId);
    return user.lives > 0;
  }

  /**
   * ЖИЗНИ: Потеря жизни при поражении
   * Использует новые формулы защиты от потери жизни
   */
  async loseLifeOnDefeat(userId: string): Promise<void> {
    await this.restoreLives(userId);
    
    const user = await this.usersService.findOne(userId);
    
    // Рассчитываем защиту от потери жизни
    const protection = this.branchesService.calculateLifeLossProtection(user.livesSp || 0, 0);
    
    // Применяем защиту (вероятность не потерять жизнь)
    const shouldLoseLife = Math.random() > protection;
    
    if (shouldLoseLife && user.lives > 0) {
      user.lives -= this.BASE_LIVES_LOSS;
      await this.usersService['usersRepository'].save(user);
    }
  }

  /**
   * ЖИЗНИ: Восстановление жизней со временем
   * Использует новые формулы из спецификации (регенерация в час)
   */
  async restoreLives(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    
    // Применяем характеристики веток (обновляем максимум)
    await this.applyBranchStats(userId);
    
    if (user.lives >= user.maxLives) {
      return;
    }

    const now = new Date();
    if (!user.lastLifeRestore) {
      user.lastLifeRestore = now;
      await this.usersService['usersRepository'].save(user);
      return;
    }

    // Рассчитываем регенерацию в час по формуле
    const regenPerHour = this.branchesService.calculateLivesRegenPerHour(user.livesSp || 0);
    
    // Переводим в интервал восстановления (каждые 4 часа восстанавливаем 1 жизнь)
    const timePassed = now.getTime() - user.lastLifeRestore.getTime();
    const hoursPassed = timePassed / (1000 * 60 * 60);
    
    if (hoursPassed > 0) {
      // Восстанавливаем жизни пропорционально прошедшему времени
      const restoreAmount = Math.floor(regenPerHour * hoursPassed);
      
      if (restoreAmount > 0) {
        user.lives = Math.min(user.lives + restoreAmount, user.maxLives);
        user.lastLifeRestore = now;
        await this.usersService['usersRepository'].save(user);
      }
    }
  }

  /**
   * ЖИЗНИ: Купить жизнь за NAR-coin с прогрессивной ценой
   * Цена растёт по числу покупок в текущие сутки: LifeRefillCost(k) = 200 NAR * (1.40^k)
   */
  async buyLife(userId: string): Promise<void> {
    await this.restoreLives(userId);
    
    const user = await this.usersService.findOne(userId);
    
    if (user.lives >= user.maxLives) {
      throw new BadRequestException('У вас максимальное количество жизней');
    }

    // Получаем количество покупок жизней сегодня
    const config = this.branchesService.getConfig().livesBranch;
    const purchasesToday = await this.getLifePurchasesToday(userId);
    const cost = Math.floor(config.refill.baseCostNar * Math.pow(config.refill.growth, purchasesToday));
    
    if (Number(user.narCoin) < cost) {
      throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${cost}`);
    }

    user.narCoin = BigInt(user.narCoin) - BigInt(cost);
    user.lives = Math.min(user.lives + config.refill.amount, user.maxLives); 
    await this.usersService['usersRepository'].save(user);
    
    // Сохраняем запись о покупке
    await this.recordLifePurchase(userId, cost);
  }

  /**
   * ЭНЕРГИЯ: Купить энергию за NAR-coin с прогрессивной ценой
   * Цена растёт по числу покупок в текущие сутки
   */
  async buyEnergy(userId: string): Promise<void> {
    await this.restoreEnergy(userId);
    
    const user = await this.usersService.findOne(userId);
    
    if (user.energy >= user.maxEnergy) {
      throw new BadRequestException('У вас максимальная энергия');
    }

    // Получаем количество покупок энергии сегодня
    const config = this.branchesService.getConfig().energyBranch;
    const purchasesToday = await this.getEnergyPurchasesToday(userId);
    const cost = Math.floor(config.refill.baseCostNar * Math.pow(config.refill.growth, purchasesToday));
    
    if (Number(user.narCoin) < cost) {
      throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${cost}`);
    }

    user.narCoin = BigInt(user.narCoin) - BigInt(cost);
    user.energy = Math.min(user.energy + config.refill.amount, user.maxEnergy);
    await this.usersService['usersRepository'].save(user);
    
    // Сохраняем запись о покупке
    await this.recordEnergyPurchase(userId, cost);
  }

  /**
   * Получить количество покупок жизней сегодня
   */
  private async getLifePurchasesToday(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const count = await this.purchasesRepository.count({
      where: {
        userId,
        type: PurchaseType.LIVES,
        purchaseDate: Between(today, tomorrow),
      },
    });
    
    return count;
  }

  /**
   * Получить количество покупок энергии сегодня
   */
  private async getEnergyPurchasesToday(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const count = await this.purchasesRepository.count({
      where: {
        userId,
        type: PurchaseType.ENERGY,
        purchaseDate: Between(today, tomorrow),
      },
    });
    
    return count;
  }

  /**
   * Записать покупку жизни
   */
  private async recordLifePurchase(userId: string, cost: number): Promise<void> {
    const purchase = this.purchasesRepository.create({
      userId,
      type: PurchaseType.LIVES,
      amount: 5,
      cost,
      purchaseDate: new Date(),
    });
    await this.purchasesRepository.save(purchase);
  }

  /**
   * Записать покупку энергии
   */
  private async recordEnergyPurchase(userId: string, cost: number): Promise<void> {
    const purchase = this.purchasesRepository.create({
      userId,
      type: PurchaseType.ENERGY,
      amount: 50,
      cost,
      purchaseDate: new Date(),
    });
    await this.purchasesRepository.save(purchase);
  }

  /**
   * СИЛА: Проверить лимит веса скинов
   * Использует новые формулы из спецификации
   */
  async checkSkinWeightLimit(userId: string, skinWeight: number): Promise<boolean> {
    const user = await this.usersService.findOne(userId);
    const maxWeight = this.branchesService.calculateWeightLimit(user.powerSp || 0);
    return skinWeight <= maxWeight;
  }

  /**
   * СИЛА: Получить текущий лимит веса скинов
   */
  async getSkinWeightLimit(userId: string): Promise<number> {
    const user = await this.usersService.findOne(userId);
    return this.branchesService.calculateWeightLimit(user.powerSp || 0);
  }

  /**
   * ЛИЦЕНЗИЯ ПРЕДПРИНИМАТЕЛЯ: Купить лицензию на уровне 5
   * Стоимость: 10000 NAR
   */
  async buyBusinessLicense(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    
    if (user.hasBusinessLicense) {
      throw new BadRequestException('У вас уже есть лицензия предпринимателя');
    }
    
    if (user.level < 5) {
      throw new BadRequestException('Лицензия предпринимателя доступна только с уровня 5');
    }
    
    const licenseCost = 10000;
    
    if (Number(user.narCoin) < licenseCost) {
      throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${licenseCost}`);
    }
    
    user.narCoin = BigInt(Number(user.narCoin) - licenseCost);
    user.hasBusinessLicense = true;
    await this.usersService['usersRepository'].save(user);
  }

  /**
   * Пополнить казну города (вызывается при комиссиях в играх)
   */
  async addToCityTreasury(amount: number): Promise<void> {
    let treasury = await this.treasuryRepository.findOne({ where: {} });
    if (!treasury) {
      treasury = this.treasuryRepository.create({
        balance: BigInt(0),
        totalCollected: BigInt(0),
        totalPaid: BigInt(0),
      });
    }
    
    treasury.balance = BigInt(Number(treasury.balance) + amount);
    treasury.totalCollected = BigInt(Number(treasury.totalCollected) + amount);
    await this.treasuryRepository.save(treasury);
    
    // Проверяем и выплачиваем задолженности по наградам
    await this.payRewardDebts();
  }

  /**
   * Выплатить задолженности по наградам за уровни
   */
  private async payRewardDebts(): Promise<void> {
    const unpaidDebts = await this.rewardDebtRepository.find({
      where: { paid: false },
      order: { createdAt: 'ASC' },
    });
    
    if (unpaidDebts.length === 0) {
      return;
    }
    
    let treasury = await this.treasuryRepository.findOne({ where: {} });
    if (!treasury) {
      return;
    }
    
    let treasuryBalance = Number(treasury.balance);
    
    for (const debt of unpaidDebts) {
      if (treasuryBalance <= 0) {
        break;
      }
      
      const debtAmount = Number(debt.amount);
      const pay = Math.min(treasuryBalance, debtAmount);
      
      if (pay > 0) {
        // Выплачиваем задолженность
        const user = await this.usersService.findOne(debt.userId);
        if (user) {
          user.narCoin = BigInt(Number(user.narCoin) + pay);
          await this.usersService['usersRepository'].save(user);
        }
        
        treasuryBalance -= pay;
        treasury.balance = BigInt(treasuryBalance);
        treasury.totalPaid = BigInt(Number(treasury.totalPaid) + pay);
        
        // Если задолженность полностью выплачена, отмечаем как оплаченную
        if (pay >= debtAmount) {
          debt.paid = true;
          debt.paidAt = new Date();
          await this.rewardDebtRepository.save(debt);
        } else {
          // Частичная выплата - обновляем сумму задолженности
          debt.amount = BigInt(debtAmount - pay);
          await this.rewardDebtRepository.save(debt);
        }
      }
    }
    
    await this.treasuryRepository.save(treasury);
  }

  /**
   * Синхронизирует уровень пользователя с его XP
   * Используется для исправления рассинхронизации уровня и XP
   * Публичный метод для использования в других сервисах
   */
  async syncLevelFromXP(userId: string): Promise<User> {
    const user = await this.usersService.findOne(userId);
    const totalXP = Number(user.xp || 0);
    const correctLevel = this.getLevelFromTotalXP(totalXP);
    const finalLevel = Math.max(1, correctLevel);
    
    if (user.level !== finalLevel) {
      user.level = finalLevel;
      await this.usersService['usersRepository'].save(user);
    }
    return user;
  }
}

