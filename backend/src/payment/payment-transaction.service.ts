import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { PaymentTransaction, PaymentStatus, PaymentMethod, PaymentType } from './payment-transaction.entity';
import { SubscriptionPlan } from '../subscription/subscription.entity';
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
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
    private usersService: UsersService,
    @Inject(forwardRef(() => ReferralsService))
    private referralsService: ReferralsService,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
  ) {}


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
    
    // Для STARS используем цену STARS из админки
    const price = Number(planPrices.stars);
    if (!price || price <= 0) {
      throw new BadRequestException(`Цена STARS для плана ${planKey} не установлена. Обратитесь к администратору.`);
    }
    return price;
  }

  /**
   * Создать транзакцию для оплаты подписки
   */
  async createSubscriptionTransaction(
    userId: string,
    plan: SubscriptionPlan,
    method: PaymentMethod = PaymentMethod.TELEGRAM_STARS,
  ): Promise<PaymentTransaction> {
    // Определяем сумму платежа из настроек в зависимости от метода оплаты
    const amount = await this.getSubscriptionPrice(plan, method);
    
    // Генерируем комментарий для идентификации платежа (необязательный)
    const transactionId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const comment = `${userId}_${transactionId}`;

    // Создаем транзакцию с временем истечения (15 минут)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const transaction = this.transactionRepository.create({
      userId,
      type: PaymentType.SUBSCRIPTION,
      method,
      status: PaymentStatus.PENDING,
      amount,
      subscriptionPlan: plan,
      comment: comment,
      expiresAt,
      metadata: {
        plan,
        userId,
        transactionId,
      },
    });

    const savedTransaction = await this.transactionRepository.save(transaction);
    this.logger.log(`✅ Создана транзакция для подписки: userId=${userId}, plan=${plan}, amount=${amount}`);

    return savedTransaction;
  }

  /**
   * Создать транзакцию для покупки NAR-coin
   * @param userId ID пользователя
   * @param amount Цена в Stars из пакета (установлена админом)
   * @param method Метод оплаты
   * @param narAmount Количество NAR из пакета (установлено админом)
   */
  async createNarCoinTransaction(
    userId: string,
    amount: number, // Цена в Stars из пакета
    method: PaymentMethod = PaymentMethod.TELEGRAM_STARS,
    narAmount?: number, // Количество NAR из пакета
  ): Promise<PaymentTransaction> {
    // Генерируем комментарий для идентификации платежа (необязательный)
    const transactionId = `nar_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const comment = `${userId}_${transactionId}`;

    // Создаем транзакцию с временем истечения (15 минут)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const transaction = this.transactionRepository.create({
      userId,
      type: PaymentType.NAR_COIN,
      method,
      status: PaymentStatus.PENDING,
      amount, // Цена из пакета
      comment: comment,
      expiresAt,
      metadata: {
        userId,
        transactionId,
        narAmount: narAmount || 0, // Количество NAR из пакета
      },
    });

    const savedTransaction = await this.transactionRepository.save(transaction);
    this.logger.log(`✅ Создана транзакция для покупки NAR-coin: userId=${userId}, amount=${amount} Stars, narAmount=${narAmount || 0} NAR`);

    return savedTransaction;
  }

  /**
   * Получить транзакцию по ID
   */
  async getTransaction(transactionId: string): Promise<PaymentTransaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['subscription'],
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
      // Для Stars/Tribute платежей проверка транзакций не требуется
      // Платежи обрабатываются через webhook от Telegram
      transaction.checkAttempts += 1;
      this.logger.log(`🔍 Проверка транзакции ${transactionId}: attempts=${transaction.checkAttempts}`);
      
      // Для Stars/Tribute транзакции обрабатываются через webhook
      // Если транзакция еще не обработана, проверяем время истечения
      const now = new Date();
      if (transaction.expiresAt && now > transaction.expiresAt) {
        transaction.status = PaymentStatus.FAILED;
        transaction.lastError = 'Время на оплату истекло (15 минут)';
        this.logger.warn(`⏰ Транзакция ${transactionId} истекла по времени`);
      } else if (transaction.status === PaymentStatus.PENDING) {
        // Оставляем в статусе PENDING, webhook обработает
        this.logger.log(`⏳ Транзакция ${transactionId} ожидает обработки через webhook`);
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
  async processCompletedTransaction(transaction: PaymentTransaction): Promise<void> {
    this.logger.log(`🔄 ========== ОБРАБОТКА ЗАВЕРШЕННОЙ ТРАНЗАКЦИИ ==========`);
    this.logger.log(`🔄 transactionId=${transaction.id}, type=${transaction.type}, userId=${transaction.userId}`);
    this.logger.log(`🔄 subscriptionPlan=${transaction.subscriptionPlan}, method=${transaction.method}`);

    if (transaction.type === PaymentType.SUBSCRIPTION && transaction.subscriptionPlan) {
      this.logger.log(`🔄 Создаю подписку для пользователя ${transaction.userId}, план: ${transaction.subscriptionPlan}`);
      
      // Создаем подписку
      const subscription = await this.subscriptionService.createSubscription(
        transaction.userId,
        transaction.subscriptionPlan,
        transaction.id,
      );

      this.logger.log(`✅ Подписка создана: subscriptionId=${subscription.id}`);

      transaction.subscriptionId = subscription.id;
      await this.transactionRepository.save(transaction);

      // Реферальный бонус для подписок не начисляется (или можно настроить в админке)

      this.logger.log(`✅ ========== ПОДПИСКА АКТИВИРОВАНА ==========`);
      this.logger.log(`✅ userId=${transaction.userId}, subscriptionId=${subscription.id}, plan=${transaction.subscriptionPlan}`);
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

