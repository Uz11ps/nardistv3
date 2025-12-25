import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { PaymentTransaction, PaymentStatus, PaymentMethod, PaymentType } from './payment-transaction.entity';
import { SubscriptionPlan } from '../subscription/subscription.entity';
import { TonService } from './ton.service';
import { WalletService } from './wallet.service';
import { Inject, forwardRef } from '@nestjs/common';
import { SubscriptionService } from '../subscription/subscription.service';
import { UsersService } from '../users/users.service';
import { ReferralsService } from '../referrals/referrals.service';
import { AdminService } from '../admin/admin.service';

/**
 * Сервис для управления транзакциями платежей
 */
@Injectable()
export class PaymentTransactionService {
  private readonly logger = new Logger(PaymentTransactionService.name);
  
  constructor(
    @InjectRepository(PaymentTransaction)
    private transactionRepository: Repository<PaymentTransaction>,
    private tonService: TonService,
    private walletService: WalletService,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
    private usersService: UsersService,
    @Inject(forwardRef(() => ReferralsService))
    private referralsService: ReferralsService,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
  ) {}

  /**
   * Получить курс TON к NAR из настроек
   */
  private async getTonRate(): Promise<number> {
    const settings = await this.adminService.getSystemSettings();
    return Number(settings.ton_exchange_rate) || 1000;
  }

  /**
   * Получить цены подписок из настроек
   */
  private async getSubscriptionPrices(): Promise<{ [key in SubscriptionPlan]: number }> {
    const prices = await this.adminService.getSubscriptionPrices();
    return {
      [SubscriptionPlan.MONTH_1]: Number(prices.month_1) || 3,
      [SubscriptionPlan.MONTH_3]: Number(prices.month_3) || 7,
      [SubscriptionPlan.MONTH_12]: Number(prices.month_12) || 22,
    };
  }

  /**
   * Создать транзакцию для оплаты подписки
   */
  async createSubscriptionTransaction(
    userId: string,
    plan: SubscriptionPlan,
    method: PaymentMethod = PaymentMethod.TON,
  ): Promise<PaymentTransaction> {
    // Получаем или создаем кошелек пользователя
    const wallet = await this.walletService.getOrCreateWallet(userId);
    
    // Определяем сумму платежа из настроек
    const prices = await this.getSubscriptionPrices();
    const amount = prices[plan];
    
    // Генерируем комментарий для идентификации платежа
    const transactionId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const comment = this.tonService.generatePaymentComment(userId, transactionId);

    // Создаем транзакцию
    const transaction = this.transactionRepository.create({
      userId,
      walletId: wallet.id,
      type: PaymentType.SUBSCRIPTION,
      method,
      status: PaymentStatus.PENDING,
      amount,
      subscriptionPlan: plan,
      toAddress: wallet.address,
      comment,
      metadata: {
        plan,
        userId,
        transactionId,
      },
    });

    const savedTransaction = await this.transactionRepository.save(transaction);
    this.logger.log(`✅ Создана транзакция для подписки: userId=${userId}, plan=${plan}, amount=${amount} TON`);

    return savedTransaction;
  }

  /**
   * Создать транзакцию для покупки NAR-coin
   */
  async createNarCoinTransaction(
    userId: string,
    amount: number, // количество TON для покупки
    method: PaymentMethod = PaymentMethod.TON,
  ): Promise<PaymentTransaction> {
    // Получаем или создаем кошелек пользователя
    const wallet = await this.walletService.getOrCreateWallet(userId);
    
    // Генерируем комментарий для идентификации платежа
    const transactionId = `nar_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const comment = this.tonService.generatePaymentComment(userId, transactionId);

    // Получаем текущий курс
    const tonRate = await this.getTonRate();

    // Создаем транзакцию
    const transaction = this.transactionRepository.create({
      userId,
      walletId: wallet.id,
      type: PaymentType.NAR_COIN,
      method,
      status: PaymentStatus.PENDING,
      amount,
      toAddress: wallet.address,
      comment,
      metadata: {
        userId,
        transactionId,
        narAmount: Math.floor(amount * tonRate),
        rate: tonRate,
      },
    });

    const savedTransaction = await this.transactionRepository.save(transaction);
    this.logger.log(`✅ Создана транзакция для покупки NAR-coin: userId=${userId}, amount=${amount} TON`);

    return savedTransaction;
  }

  /**
   * Получить транзакцию по ID
   */
  async getTransaction(transactionId: string): Promise<PaymentTransaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['wallet', 'subscription'],
    });

    if (!transaction) {
      throw new NotFoundException('Транзакция не найдена');
    }

    return transaction;
  }

  /**
   * Получить транзакции пользователя
   */
  async getUserTransactions(userId: string): Promise<PaymentTransaction[]> {
    return this.transactionRepository.find({
      where: { userId },
      relations: ['subscription'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Проверить транзакцию в блокчейне и обновить статус
   */
  async checkTransactionStatus(transactionId: string): Promise<PaymentTransaction> {
    const transaction = await this.getTransaction(transactionId);

    if (transaction.status === PaymentStatus.COMPLETED) {
      return transaction; // Уже обработана
    }

    if (transaction.status === PaymentStatus.FAILED || transaction.status === PaymentStatus.CANCELLED) {
      return transaction; // Не обрабатываем
    }

    try {
      // Проверяем транзакцию в блокчейне
      const txInfo = await this.tonService.checkTransaction(
        transaction.txHash || '',
        transaction.toAddress,
      );

      transaction.checkAttempts += 1;

      if (txInfo.found) {
        // Транзакция найдена
        transaction.status = PaymentStatus.COMPLETED;
        transaction.txHash = transaction.txHash || txInfo.fromAddress || '';
        transaction.lt = txInfo.lt;
        transaction.fromAddress = txInfo.fromAddress;
        transaction.confirmedAt = new Date();
        transaction.amount = txInfo.amount;

        // Обрабатываем платеж
        await this.processCompletedTransaction(transaction);

        this.logger.log(`✅ Транзакция ${transactionId} подтверждена и обработана`);
      } else {
        // Транзакция еще не найдена
        if (transaction.checkAttempts >= 10) {
          // Превышено количество попыток проверки
          transaction.status = PaymentStatus.FAILED;
          transaction.lastError = 'Превышено количество попыток проверки транзакции';
        } else {
          transaction.status = PaymentStatus.PROCESSING;
        }
      }

      return await this.transactionRepository.save(transaction);
    } catch (error: any) {
      transaction.lastError = error.message;
      transaction.checkAttempts += 1;
      
      if (transaction.checkAttempts >= 10) {
        transaction.status = PaymentStatus.FAILED;
      }

      await this.transactionRepository.save(transaction);
      throw error;
    }
  }

  /**
   * Обработать завершенную транзакцию
   */
  private async processCompletedTransaction(transaction: PaymentTransaction): Promise<void> {
    const tonRate = await this.getTonRate();

    if (transaction.type === PaymentType.SUBSCRIPTION && transaction.subscriptionPlan) {
      // Создаем подписку
      const subscription = await this.subscriptionService.createSubscription(
        transaction.userId,
        transaction.subscriptionPlan,
        transaction.id,
      );

      transaction.subscriptionId = subscription.id;
      await this.transactionRepository.save(transaction);

      // Начисляем реферальный бонус
      const narAmount = Math.floor(transaction.amount * tonRate);
      await this.referralsService.processReferralBonus(
        transaction.userId,
        narAmount,
        `Подписка ${transaction.subscriptionPlan}`,
      );

      this.logger.log(`✅ Подписка активирована для пользователя ${transaction.userId}`);
    } else if (transaction.type === PaymentType.NAR_COIN) {
      // Начисляем NAR-coin
      const user = await this.usersService.findOne(transaction.userId);
      // Используем narAmount из метаданных (зафиксированный при создании) или текущий курс
      const narAmount = transaction.metadata?.narAmount || Math.floor(transaction.amount * tonRate);
      
      const currentBalance = Number(user.narCoin || 0);
      await this.usersService.update(transaction.userId, {
        narCoin: currentBalance + narAmount,
      });

      // Начисляем реферальный бонус
      await this.referralsService.processReferralBonus(
        transaction.userId,
        narAmount,
        'Покупка NAR-coin',
      );

      this.logger.log(`✅ NAR-coin начислены пользователю ${transaction.userId}: +${narAmount} NAR`);
    }
  }

  /**
   * Обновить транзакцию с хешем (когда пользователь отправил платеж)
   */
  async updateTransactionHash(transactionId: string, txHash: string): Promise<PaymentTransaction> {
    const transaction = await this.getTransaction(transactionId);

    if (transaction.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Транзакция уже обработана');
    }

    transaction.txHash = txHash;
    transaction.status = PaymentStatus.PROCESSING;
    
    return await this.transactionRepository.save(transaction);
  }

  /**
   * Получить ожидающие проверки транзакции
   */
  async getPendingTransactions(limit: number = 50): Promise<PaymentTransaction[]> {
    return this.transactionRepository.find({
      where: {
        status: PaymentStatus.PROCESSING,
        checkAttempts: LessThan(10),
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }
}

