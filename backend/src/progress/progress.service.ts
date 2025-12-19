import { Injectable, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enhancement, EnhancementType } from './enhancement.entity';
import { UsersService } from '../users/users.service';
import { GameType } from '../games/game.entity';

@Injectable()
export class ProgressService {
  private readonly XP_PER_LEVEL = 1000;
  private readonly MAX_LEVEL = 50;
  private readonly ENERGY_RESTORE_INTERVAL = 30 * 60 * 1000; // 30 минут
  private readonly ENERGY_RESTORE_AMOUNT = 10; // 10 энергии за восстановление
  private readonly LIFE_RESTORE_INTERVAL = 4 * 60 * 60 * 1000; // 4 часа
  private readonly LIFE_RESTORE_AMOUNT = 1; // 1 жизнь за восстановление
  private readonly BASE_ENERGY_COST = 10; // Базовая стоимость энергии за игру
  private readonly BASE_LIVES_LOSS = 1; // Базовая потеря жизней при поражении

  constructor(
    @InjectRepository(Enhancement)
    private enhancementsRepository: Repository<Enhancement>,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
  ) {}

  async addXP(userId: string, amount: number): Promise<void> {
    const user = await this.usersService.findOne(userId);
    const newXP = Number(user.xp) + amount;
    const newLevel = Math.min(
      Math.floor(newXP / this.XP_PER_LEVEL) + 1,
      this.MAX_LEVEL,
    );

    user.xp = BigInt(newXP);
    if (newLevel > user.level) {
      user.level = newLevel;
    }
    await this.usersService['usersRepository'].save(user);
  }

  async addNarCoin(userId: string, amount: number): Promise<void> {
    const user = await this.usersService.findOne(userId);
    user.narCoin = BigInt(user.narCoin || 0) + BigInt(amount);
    await this.usersService['usersRepository'].save(user);
  }

  async chooseEnhancement(userId: string, type: EnhancementType): Promise<void> {
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

    const user = await this.usersService.findOne(userId);
    user.enhancement = type;
    await this.usersService['usersRepository'].save(user);
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
   * ЭКОНОМИКА: Рассчитать комиссию с учетом усиления
   * @param baseFee - базовая комиссия
   * @param enhancementLevel - уровень усиления экономики
   * @returns итоговая комиссия
   */
  calculateFeeWithEconomy(baseFee: number, enhancementLevel: number): number {
    // Каждый уровень снижает комиссию на 5%
    const reduction = Math.min(enhancementLevel * 0.05, 0.5); // Максимум 50% снижение
    return Math.floor(baseFee * (1 - reduction));
  }

  /**
   * ЭНЕРГИЯ: Проверить и потратить энергию на игру
   */
  async consumeEnergyForGame(userId: string, gameType: GameType): Promise<void> {
    // Бот-игры не тратят энергию
    if (gameType === GameType.VS_BOT) {
      return;
    }

    await this.restoreEnergy(userId); // Сначала восстанавливаем энергию
    
    const user = await this.usersService.findOne(userId);
    const enhancementLevel = await this.getEnhancementLevel(userId, EnhancementType.ENERGY);
    
    // С усилением энергии тратится меньше
    // Каждый уровень снижает расход на 2 энергии (минимум 1)
    const energyCost = Math.max(
      this.BASE_ENERGY_COST - (enhancementLevel * 2),
      1
    );

    if (user.energy < energyCost) {
      throw new BadRequestException(`Недостаточно энергии. Требуется: ${energyCost}, доступно: ${user.energy}`);
    }

    user.energy -= energyCost;
    await this.usersService['usersRepository'].save(user);
  }

  /**
   * ЭНЕРГИЯ: Восстановление энергии со временем
   */
  async restoreEnergy(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    
    if (user.energy >= user.maxEnergy) {
      return;
    }

    const now = new Date();
    if (!user.lastEnergyRestore) {
      user.lastEnergyRestore = now;
      await this.usersService['usersRepository'].save(user);
      return;
    }

    const timePassed = now.getTime() - user.lastEnergyRestore.getTime();
    const restoreCycles = Math.floor(timePassed / this.ENERGY_RESTORE_INTERVAL);

    if (restoreCycles > 0) {
      const enhancementLevel = await this.getEnhancementLevel(userId, EnhancementType.ENERGY);
      // С усилением энергии восстанавливается быстрее
      const restoreAmount = this.ENERGY_RESTORE_AMOUNT + (enhancementLevel * 2);
      
      user.energy = Math.min(user.energy + (restoreAmount * restoreCycles), user.maxEnergy);
      user.lastEnergyRestore = new Date(
        user.lastEnergyRestore.getTime() + (restoreCycles * this.ENERGY_RESTORE_INTERVAL)
      );
      await this.usersService['usersRepository'].save(user);
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
   */
  async loseLifeOnDefeat(userId: string): Promise<void> {
    await this.restoreLives(userId);
    
    const user = await this.usersService.findOne(userId);
    const enhancementLevel = await this.getEnhancementLevel(userId, EnhancementType.LIVES);
    
    // С усилением жизней можно иметь запас, который не тратится сразу
    // Первые N жизней защищены (защита = уровень усиления)
    const protectedLives = enhancementLevel;
    const effectiveLives = user.lives - protectedLives;

    if (effectiveLives > 0) {
      user.lives -= this.BASE_LIVES_LOSS;
      await this.usersService['usersRepository'].save(user);
    }
  }

  /**
   * ЖИЗНИ: Восстановление жизней со временем
   */
  async restoreLives(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    
    if (user.lives >= user.maxLives) {
      return;
    }

    const now = new Date();
    if (!user.lastLifeRestore) {
      user.lastLifeRestore = now;
      await this.usersService['usersRepository'].save(user);
      return;
    }

    const timePassed = now.getTime() - user.lastLifeRestore.getTime();
    const restoreCycles = Math.floor(timePassed / this.LIFE_RESTORE_INTERVAL);

    if (restoreCycles > 0) {
      const enhancementLevel = await this.getEnhancementLevel(userId, EnhancementType.LIVES);
      // С усилением жизней восстанавливаются быстрее
      const intervalReduction = enhancementLevel * 0.1; // Каждый уровень ускоряет на 10%
      const effectiveInterval = this.LIFE_RESTORE_INTERVAL * (1 - Math.min(intervalReduction, 0.5));
      const actualCycles = Math.floor(timePassed / effectiveInterval);
      
      if (actualCycles > restoreCycles) {
        const extraCycles = actualCycles - restoreCycles;
        user.lives = Math.min(user.lives + (this.LIFE_RESTORE_AMOUNT * extraCycles), user.maxLives);
      }
      
      user.lives = Math.min(user.lives + (this.LIFE_RESTORE_AMOUNT * restoreCycles), user.maxLives);
      user.lastLifeRestore = new Date(
        user.lastLifeRestore.getTime() + (restoreCycles * this.LIFE_RESTORE_INTERVAL)
      );
      await this.usersService['usersRepository'].save(user);
    }
  }

  /**
   * ЖИЗНИ: Купить жизнь за NAR-coin
   */
  async buyLife(userId: string): Promise<void> {
    await this.restoreLives(userId);
    
    const user = await this.usersService.findOne(userId);
    
    if (user.lives >= user.maxLives) {
      throw new BadRequestException('У вас максимальное количество жизней');
    }

    const cost = 500; // 500 NAR-coin за жизнь
    if (Number(user.narCoin) < cost) {
      throw new BadRequestException(`Недостаточно NAR-coin. Требуется: ${cost}`);
    }

    user.narCoin = BigInt(user.narCoin) - BigInt(cost);
    user.lives = Math.min(user.lives + 1, user.maxLives);
    await this.usersService['usersRepository'].save(user);
  }

  /**
   * СИЛА: Проверить лимит веса скинов
   * @param userId - ID пользователя
   * @param skinWeight - вес набора скинов
   * @returns true если можно использовать
   */
  async checkSkinWeightLimit(userId: string, skinWeight: number): Promise<boolean> {
    const enhancementLevel = await this.getEnhancementLevel(userId, EnhancementType.POWER);
    // Базовый лимит веса = 10, каждый уровень добавляет +5
    const maxWeight = 10 + (enhancementLevel * 5);
    return skinWeight <= maxWeight;
  }

  /**
   * СИЛА: Получить текущий лимит веса скинов
   */
  async getSkinWeightLimit(userId: string): Promise<number> {
    const enhancementLevel = await this.getEnhancementLevel(userId, EnhancementType.POWER);
    return 10 + (enhancementLevel * 5);
  }
}

