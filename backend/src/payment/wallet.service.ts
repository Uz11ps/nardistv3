import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserWallet } from './user-wallet.entity';
import { UsersService } from '../users/users.service';

/**
 * Сервис для управления кошельками пользователей
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(UserWallet)
    private walletRepository: Repository<UserWallet>,
    private usersService: UsersService,
  ) {}

  /**
   * Получить или создать кошелек для пользователя
   * Важно: всегда возвращает один и тот же кошелек для userId
   */
  async getOrCreateWallet(userId: string): Promise<UserWallet> {
    // Сначала проверяем, есть ли кошелек (включая неактивные)
    let wallet = await this.walletRepository.findOne({
      where: { userId },
      order: { createdAt: 'ASC' }, // Берем самый первый кошелек
    });

    if (wallet) {
      // Если кошелек есть, активируем его (если неактивен) и возвращаем
      if (!wallet.isActive) {
        wallet.isActive = true;
        await this.walletRepository.save(wallet);
      }
      return wallet;
    }

    // Если кошелька нет, создаем новый
    return await this.createWallet(userId);
  }

  /**
   * Создать новый кошелек для пользователя
   * Важно: каждый userId имеет один и тот же кошелек всегда (не создаем новый)
   */
  async createWallet(userId: string): Promise<UserWallet> {
    // Проверяем, что пользователь существует
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Проверяем, нет ли уже кошелька для этого пользователя (включая неактивные)
    const existingWallet = await this.walletRepository.findOne({
      where: { userId },
      order: { createdAt: 'ASC' }, // Берем самый первый кошелек
    });

    if (existingWallet) {
      // Если кошелек уже есть, активируем его и возвращаем
      if (!existingWallet.isActive) {
        existingWallet.isActive = true;
        await this.walletRepository.save(existingWallet);
      }
      this.logger.log(`✅ Используется существующий кошелек для пользователя ${userId}: ${existingWallet.address}`);
      return existingWallet;
    }

    // Кошельки TON больше не используются для платежей
    // Создаем заглушку (если нужна для обратной совместимости)
    throw new BadRequestException('Создание кошельков TON отключено. Используйте STARS или TRIBUTE для платежей.');
  }

  /**
   * Получить кошелек пользователя
   */
  async getWallet(userId: string): Promise<UserWallet | null> {
    return this.walletRepository.findOne({
      where: { userId, isActive: true },
    });
  }

  /**
   * Получить расшифрованный приватный ключ (только для админа)
   */
  async getDecryptedPrivateKey(walletId: string): Promise<string> {
    const wallet = await this.walletRepository.findOne({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Кошелек не найден');
    }

    throw new BadRequestException('Расшифровка приватных ключей TON отключена.');
  }

  /**
   * Получить баланс кошелька
   */
  async getWalletBalance(userId: string): Promise<number> {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      return 0;
    }

    // Баланс TON кошельков больше не используется
    return 0;
  }

  /**
   * Получить все активные кошельки (для админ панели)
   * Возвращает только активные кошельки
   */
  async getAllWallets(): Promise<UserWallet[]> {
    return this.walletRepository.find({
      where: { isActive: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}

