import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserWallet } from './user-wallet.entity';
import { TonService } from './ton.service';
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
    private tonService: TonService,
    private usersService: UsersService,
  ) {}

  /**
   * Получить или создать кошелек для пользователя
   */
  async getOrCreateWallet(userId: string): Promise<UserWallet> {
    let wallet = await this.walletRepository.findOne({
      where: { userId, isActive: true },
    });

    if (!wallet) {
      // Создаем новый кошелек
      wallet = await this.createWallet(userId);
    }

    return wallet;
  }

  /**
   * Создать новый кошелек для пользователя
   */
  async createWallet(userId: string): Promise<UserWallet> {
    // Проверяем, что пользователь существует
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Деактивируем старые кошельки (если есть)
    await this.walletRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );

    // Генерируем новый кошелек
    const walletData = await this.tonService.generateWallet();

    // Шифруем приватный ключ
    const { encrypted, iv } = this.tonService.encryptPrivateKey(walletData.privateKey);

    // Создаем запись в БД
    const wallet = this.walletRepository.create({
      userId,
      address: walletData.address,
      encryptedPrivateKey: encrypted,
      iv,
      publicKey: walletData.publicKey,
      walletType: walletData.walletType,
      isActive: true,
    });

    const savedWallet = await this.walletRepository.save(wallet);
    this.logger.log(`✅ Создан кошелек для пользователя ${userId}: ${walletData.address}`);

    return savedWallet;
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

    return this.tonService.decryptPrivateKey(wallet.encryptedPrivateKey, wallet.iv);
  }

  /**
   * Получить баланс кошелька
   */
  async getWalletBalance(userId: string): Promise<number> {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      return 0;
    }

    return this.tonService.getWalletBalance(wallet.address);
  }

  /**
   * Получить все кошельки (для админ панели)
   */
  async getAllWallets(): Promise<UserWallet[]> {
    return this.walletRepository.find({
      where: { isActive: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}

