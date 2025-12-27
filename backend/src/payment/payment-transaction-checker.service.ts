import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentTransactionService } from './payment-transaction.service';

/**
 * Сервис для автоматической проверки транзакций
 */
@Injectable()
export class PaymentTransactionCheckerService {
  private readonly logger = new Logger(PaymentTransactionCheckerService.name);

  constructor(
    private paymentTransactionService: PaymentTransactionService,
  ) {}

  /**
   * Проверка транзакций каждые 2 минуты
   */
  @Cron('*/2 * * * *') // Каждые 2 минуты
  async checkTransactions() {
    this.logger.log('🔄 Запуск автоматической проверки транзакций...');
    try {
      await this.paymentTransactionService.checkPendingTransactions();
    } catch (error: any) {
      this.logger.error(`❌ Ошибка при автоматической проверке транзакций: ${error.message}`);
    }
  }
}

