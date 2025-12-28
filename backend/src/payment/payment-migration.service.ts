import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Сервис для миграции старых значений payment method
 * Выполняется автоматически при старте приложения
 */
@Injectable()
export class PaymentMigrationService implements OnModuleInit {
  private readonly logger = new Logger(PaymentMigrationService.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.migratePaymentMethods();
  }

  /**
   * Миграция старых значений method = 'ton' и 'usdt' на новые
   */
  async migratePaymentMethods(): Promise<void> {
    try {
      // Проверяем, есть ли таблица payment_transactions
      const queryRunner = this.dataSource.createQueryRunner();
      const tableExists = await queryRunner.hasTable('payment_transactions');
      
      if (!tableExists) {
        this.logger.log('📊 Таблица payment_transactions не существует, миграция не требуется');
        return;
      }

      // Проверяем, есть ли записи со старыми значениями
      const oldTonCount = await queryRunner.query(
        `SELECT COUNT(*) as count FROM payment_transactions WHERE method = 'ton'`,
      );
      const oldUsdtCount = await queryRunner.query(
        `SELECT COUNT(*) as count FROM payment_transactions WHERE method = 'usdt'`,
      );

      const tonCount = parseInt(oldTonCount[0]?.count || '0', 10);
      const usdtCount = parseInt(oldUsdtCount[0]?.count || '0', 10);

      if (tonCount === 0 && usdtCount === 0) {
        this.logger.log('✅ Миграция payment methods не требуется');
        return;
      }

      this.logger.log(`🔄 Найдено ${tonCount} записей с method='ton' и ${usdtCount} записей с method='usdt'`);
      this.logger.log('🔄 Выполняю миграцию...');

      // Обновляем все записи с method = 'ton' на 'telegram_stars'
      if (tonCount > 0) {
        await queryRunner.query(
          `UPDATE payment_transactions SET method = 'telegram_stars' WHERE method = 'ton'`,
        );
        this.logger.log(`✅ Обновлено ${tonCount} записей: ton -> telegram_stars`);
      }

      // Обновляем все записи с method = 'usdt' на 'telegram_stars'
      if (usdtCount > 0) {
        await queryRunner.query(
          `UPDATE payment_transactions SET method = 'telegram_stars' WHERE method = 'usdt'`,
        );
        this.logger.log(`✅ Обновлено ${usdtCount} записей: usdt -> telegram_stars`);
      }

      this.logger.log('✅ Миграция payment methods завершена успешно');
    } catch (error: any) {
      // Не критичная ошибка - просто логируем
      this.logger.warn(`⚠️ Ошибка при миграции payment methods: ${error.message}`);
      this.logger.debug(error.stack);
    }
  }
}

