import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enhancement, EnhancementType } from './enhancement.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ProgressService {
  private readonly XP_PER_LEVEL = 1000;
  private readonly MAX_LEVEL = 50;

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
}

