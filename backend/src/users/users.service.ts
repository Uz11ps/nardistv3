import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ProgressService } from '../progress/progress.service';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => ProgressService))
    private progressService: ProgressService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const referralCode = this.generateReferralCode();
    const user = this.usersRepository.create({
      ...createUserDto,
      referralCode,
    });
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return user;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { telegramId } });
  }

  async findByReferralCode(referralCode: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { referralCode } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async updateTelegramData(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, data);
    return this.usersRepository.save(user);
  }

  async banUser(id: string, reason: string): Promise<User> {
    const user = await this.findOne(id);
    user.isBanned = true;
    user.banReason = reason;
    return this.usersRepository.save(user);
  }

  async unbanUser(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isBanned = false;
    user.banReason = null;
    return this.usersRepository.save(user);
  }

  async getOnboardingProgress(userId: string): Promise<Record<string, boolean>> {
    const user = await this.findOne(userId);
    // Проверяем прогресс онбординга на основе игр пользователя
    // Здесь можно добавить логику проверки выполненных шагов
    return {
      bot_training: false, // Проверяется через историю игр с ботом
      first_online: false, // Проверяется через историю онлайн игр
      view_city: false, // Устанавливается вручную при просмотре города
    };
  }

  async completeOnboardingStep(userId: string, stepId: string): Promise<User> {
    const user = await this.findOne(userId);
    
    // Награждаем за выполнение шага
    const rewardNarCoin = 100;
    const rewardXP = 50;
    
    await this.progressService.addXP(userId, rewardXP);
    await this.progressService.addNarCoin(userId, rewardNarCoin);
    
    return user;
  }

  private generateReferralCode(): string {
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }
}

