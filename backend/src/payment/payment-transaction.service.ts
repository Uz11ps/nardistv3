import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
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
   * Получить цену подписки из настроек в зависимости от метода оплаты
   */
  private async getSubscriptionPrice(plan: SubscriptionPlan, method: PaymentMethod): Promise<number> {
    const prices = await this.adminService.getSubscriptionPrices();
    
    if (!prices) {
      throw new BadRequestException('Цены подписок не установлены. Обратитесь к администратору.');
    }
    
    const planKey = plan === SubscriptionPlan.MONTH_1 ? 'month_1' : plan === SubscriptionPlan.MONTH_3 ? 'month_3' : 'month_12';
    const planPrices = prices[planKey];
    
    if (!planPrices) {
      throw new BadRequestException(`Цена для плана ${planKey} не установлена. Обратитесь к администратору.`);
    }
    
    if (method === PaymentMethod.USDT) {
      const price = Number(planPrices.usdt);
      if (!price || price <= 0) {
        throw new BadRequestException(`Цена USDT для плана ${planKey} не установлена. Обратитесь к администратору.`);
      }
      return price;
    }
    
    const price = Number(planPrices.ton);
    if (!price || price <= 0) {
      throw new BadRequestException(`Цена TON для плана ${planKey} не установлена. Обратитесь к администратору.`);
    }
    return price;
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
    
    // Определяем сумму платежа из настроек в зависимости от метода оплаты
    const amount = await this.getSubscriptionPrice(plan, method);
    
    // Генерируем комментарий для идентификации платежа (необязательный)
    const transactionId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const comment = this.tonService.generatePaymentComment(userId, transactionId);

    // Создаем транзакцию с временем истечения (15 минут)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const transaction = this.transactionRepository.create({
      userId,
      walletId: wallet.id,
      type: PaymentType.SUBSCRIPTION,
      method,
      status: PaymentStatus.PENDING,
      amount,
      subscriptionPlan: plan,
      toAddress: wallet.address,
      comment: comment, // Комментарий необязательный, но генерируем для удобства идентификации
      expiresAt,
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
   * @param userId ID пользователя
   * @param amount Цена в TON/USDT из пакета (установлена админом)
   * @param method Метод оплаты
   * @param narAmount Количество NAR из пакета (установлено админом)
   */
  async createNarCoinTransaction(
    userId: string,
    amount: number, // Цена в TON/USDT из пакета
    method: PaymentMethod = PaymentMethod.TON,
    narAmount?: number, // Количество NAR из пакета
  ): Promise<PaymentTransaction> {
    // Получаем или создаем кошелек пользователя
    const wallet = await this.walletService.getOrCreateWallet(userId);
    
    // Генерируем комментарий для идентификации платежа (необязательный)
    const transactionId = `nar_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const comment = this.tonService.generatePaymentComment(userId, transactionId);

    // Создаем транзакцию с временем истечения (15 минут)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const transaction = this.transactionRepository.create({
      userId,
      walletId: wallet.id,
      type: PaymentType.NAR_COIN,
      method,
      status: PaymentStatus.PENDING,
      amount, // Цена из пакета
      toAddress: wallet.address,
      comment: comment,
      expiresAt,
      metadata: {
        userId,
        transactionId,
        narAmount: narAmount || 0, // Количество NAR из пакета
      },
    });

    const savedTransaction = await this.transactionRepository.save(transaction);
    this.logger.log(`✅ Создана транзакция для покупки NAR-coin: userId=${userId}, amount=${amount} TON, narAmount=${narAmount || 0} NAR`);

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
   * Найти транзакции пользователя по методу оплаты
   */
  async findTransactionsByUserAndMethod(
    userId: string,
    method: PaymentMethod,
  ): Promise<PaymentTransaction[]> {
    return this.transactionRepository.find({
      where: {
        userId,
        method,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Обновить транзакцию
   */
  async updateTransaction(transaction: PaymentTransaction): Promise<PaymentTransaction> {
    return this.transactionRepository.save(transaction);
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

    // Проверяем истечение времени (15 минут)
    const now = new Date();
    if (transaction.expiresAt && now > transaction.expiresAt) {
      transaction.status = PaymentStatus.FAILED;
      transaction.lastError = 'Время на оплату истекло (15 минут)';
      return await this.transactionRepository.save(transaction);
    }

    // Если нет хеша транзакции, не проверяем
    if (!transaction.txHash) {
      return transaction;
    }

    try {
      // Проверяем транзакцию в блокчейне
      // Передаем ожидаемую сумму и комментарий для более надежной проверки
      const txInfo = await this.tonService.checkTransaction(
        transaction.txHash,
        transaction.toAddress,
        Number(transaction.amount),
        transaction.comment || undefined,
      );

      transaction.checkAttempts += 1;
      this.logger.log(`🔍 Проверка транзакции ${transactionId}: attempts=${transaction.checkAttempts}, found=${txInfo.found}`);

      if (txInfo.found) {
        // Проверяем сумму (с небольшой погрешностью)
        const amountDiff = Math.abs(txInfo.amount - Number(transaction.amount));
        if (amountDiff > 0.01) {
          this.logger.warn(`⚠️ Сумма транзакции не совпадает: ожидалось ${transaction.amount}, получено ${txInfo.amount}`);
          // Все равно принимаем, но логируем предупреждение
        }
        
        // Транзакция найдена
        transaction.status = PaymentStatus.COMPLETED;
        transaction.lt = txInfo.lt;
        transaction.fromAddress = txInfo.fromAddress;
        transaction.confirmedAt = new Date();
        transaction.amount = txInfo.amount;

        // Обрабатываем платеж
        await this.processCompletedTransaction(transaction);

        this.logger.log(`✅ Транзакция ${transactionId} подтверждена и обработана`);
      } else {
        // Транзакция еще не найдена - проверяем время истечения еще раз
        if (transaction.expiresAt && now > transaction.expiresAt) {
          transaction.status = PaymentStatus.FAILED;
          transaction.lastError = 'Время на оплату истекло (15 минут)';
          this.logger.warn(`⏰ Транзакция ${transactionId} истекла по времени`);
        } else {
          transaction.status = PaymentStatus.PROCESSING;
          this.logger.log(`⏳ Транзакция ${transactionId} еще не найдена в блокчейне, статус: PROCESSING`);
        }
      }

      return await this.transactionRepository.save(transaction);
    } catch (error: any) {
      this.logger.error(`❌ Ошибка при проверке транзакции ${transactionId}: ${error.message}`);
      transaction.lastError = error.message;
      transaction.checkAttempts += 1;
      
      // Проверяем время истечения при ошибке
      if (transaction.expiresAt && now > transaction.expiresAt) {
        transaction.status = PaymentStatus.FAILED;
        transaction.lastError = 'Время на оплату истекло (15 минут)';
        this.logger.warn(`⏰ Транзакция ${transactionId} истекла по времени`);
      } else if (transaction.checkAttempts >= 20) {
        // Увеличиваем лимит попыток до 20
        transaction.status = PaymentStatus.FAILED;
        transaction.lastError = 'Превышено количество попыток проверки транзакции';
        this.logger.warn(`❌ Транзакция ${transactionId} провалена: превышен лимит попыток`);
      } else {
        // Продолжаем проверку при следующем запуске cron
        transaction.status = PaymentStatus.PROCESSING;
        this.logger.log(`⏳ Транзакция ${transactionId} будет проверена снова (попытка ${transaction.checkAttempts})`);
      }

      await this.transactionRepository.save(transaction);
      // Не бросаем исключение, чтобы не прерывать проверку других транзакций
      return transaction;
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
      // Используем narAmount из метаданных (из пакета, установленного админом)
      const narAmount = transaction.metadata?.narAmount;
      
      if (!narAmount || narAmount <= 0) {
        this.logger.error(`❌ Ошибка: не указано количество NAR в транзакции ${transaction.id}`);
        throw new BadRequestException('Не указано количество NAR в транзакции');
      }
      
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

    if (transaction.status !== PaymentStatus.PENDING && transaction.status !== PaymentStatus.PROCESSING) {
      throw new BadRequestException('Транзакция уже обработана');
    }

    // Нормализуем хеш (убираем префиксы, пробелы, приводим к нижнему регистру)
    const normalizedHash = txHash.trim().toLowerCase().replace(/^0x/, '');
    
    this.logger.log(`📝 Обновление хеша транзакции ${transactionId}: ${normalizedHash}`);
    
    transaction.txHash = normalizedHash;
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

  /**
   * Проверить все pending и processing транзакции
   * Вызывается периодически через cron
   */
  async checkPendingTransactions(): Promise<void> {
    this.logger.log('🔍 Начинаю проверку pending транзакций...');
    
    try {
      // Находим все транзакции, которые нужно проверить
      const transactions = await this.transactionRepository.find({
        where: {
          status: In([PaymentStatus.PENDING, PaymentStatus.PROCESSING]),
        },
      });

      this.logger.log(`📊 Найдено ${transactions.length} транзакций для проверки`);

      let checked = 0;
      let completed = 0;
      let failed = 0;

      for (const transaction of transactions) {
        try {
          // Пропускаем транзакции без хеша
          if (!transaction.txHash) {
            continue;
          }

          // Проверяем истечение времени
          const now = new Date();
          if (transaction.expiresAt && now > transaction.expiresAt) {
            if (transaction.status !== PaymentStatus.FAILED) {
              transaction.status = PaymentStatus.FAILED;
              transaction.lastError = 'Время на оплату истекло (15 минут)';
              await this.transactionRepository.save(transaction);
              failed++;
            }
            continue;
          }

          // Проверяем транзакцию в блокчейне
          const updatedTransaction = await this.checkTransactionStatus(transaction.id);
          
          if (updatedTransaction.status === PaymentStatus.COMPLETED) {
            completed++;
          } else if (updatedTransaction.status === PaymentStatus.FAILED) {
            failed++;
          }
          
          checked++;
        } catch (error: any) {
          this.logger.error(`❌ Ошибка при проверке транзакции ${transaction.id}: ${error.message}`);
        }
      }

      this.logger.log(`✅ Проверка завершена: проверено ${checked}, завершено ${completed}, провалено ${failed}`);
    } catch (error: any) {
      this.logger.error(`❌ Ошибка при проверке pending транзакций: ${error.message}`);
    }
  }
}

