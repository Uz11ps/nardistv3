import { Controller, Get, Post, Body, UseGuards, Param, NotFoundException, BadRequestException, Query } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PaymentTransactionService } from '../payment/payment-transaction.service';
import { WalletService } from '../payment/wallet.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionPlan } from './subscription.entity';
import { PaymentMethod } from '../payment/payment-transaction.entity';
import { AdminService } from '../admin/admin.service';
import { Inject, forwardRef } from '@nestjs/common';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentTransactionService: PaymentTransactionService,
    private readonly walletService: WalletService,
    @Inject(forwardRef(() => AdminService))
    private readonly adminService: AdminService,
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser() user: any) {
    try {
      if (!user || !user.id) {
        console.error('❌ Subscription status: пользователь не найден:', user);
        return { hasActive: false };
      }
      const hasActive = await this.subscriptionService.hasActiveSubscription(user.id);
      return { hasActive };
    } catch (error) {
      console.error('❌ Ошибка при получении статуса подписки:', error);
      return { hasActive: false };
    }
  }

  @Get('plans')
  async getPlans(@Query('method') method?: string) {
    const prices = await this.adminService.getSubscriptionPrices();
    
    // Если цены не установлены в админке, возвращаем пустой массив
    if (!prices) {
      return [];
    }
    
    const paymentMethod = method?.toLowerCase() === 'usdt' ? 'usdt' : 'ton';
    
    const getPrice = (planPrices: { ton: number; usdt: number }) => {
      return paymentMethod === 'usdt' ? planPrices.usdt : planPrices.ton;
    };
    
    return [
      { 
        id: 'month_1', 
        name: '1 месяц', 
        price: Number(getPrice(prices.month_1)), 
        priceTon: Number(prices.month_1.ton),
        priceUsdt: Number(prices.month_1.usdt),
        currency: paymentMethod.toUpperCase(), 
        badge: 'Попробовать' 
      },
      { 
        id: 'month_3', 
        name: '3 месяца', 
        price: Number(getPrice(prices.month_3)), 
        priceTon: Number(prices.month_3.ton),
        priceUsdt: Number(prices.month_3.usdt),
        currency: paymentMethod.toUpperCase(), 
        badge: 'Оптимально', 
        popular: true 
      },
      { 
        id: 'month_12', 
        name: '1 год', 
        price: Number(getPrice(prices.month_12)), 
        priceTon: Number(prices.month_12.ton),
        priceUsdt: Number(prices.month_12.usdt),
        currency: paymentMethod.toUpperCase(), 
        badge: 'Выгоднее' 
      },
    ];
  }

  /**
   * Получить пакеты NAR-coin (используется в Shop.tsx)
   */
  @Get('nar-coin-packages')
  async getNarCoinPackages(@Query('method') method?: string) {
    const packages = await this.adminService.getNarCoinPrices();
    const paymentMethod = method?.toLowerCase() === 'usdt' ? 'usdt' : 'ton';
    
    return packages.map(pkg => {
      const price = paymentMethod === 'usdt' 
        ? Number(pkg.priceUsdt || 0)
        : Number(pkg.priceTon || 0);
      
      return {
        amount: pkg.amount,
        price,
        priceTon: Number(pkg.priceTon || 0),
        priceUsdt: Number(pkg.priceUsdt || 0),
        currency: paymentMethod.toUpperCase()
      };
    });
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  async purchase(@CurrentUser() user: any, @Body() body: { plan: SubscriptionPlan }) {
    return this.subscriptionService.createSubscription(user.id, body.plan);
  }

  /**
   * Создать транзакцию для оплаты подписки через TON/USDT
   */
  @Post('payment/create')
  @UseGuards(JwtAuthGuard)
  async createPayment(@CurrentUser() user: any, @Body() body: { plan: SubscriptionPlan; method?: PaymentMethod | string }) {
    try {
      if (!body.plan) {
        throw new BadRequestException('Не выбрана подписка');
      }

      // Преобразуем строку в enum (если пришла строка с фронтенда)
      let method: PaymentMethod = PaymentMethod.TON;
      if (body.method) {
        if (typeof body.method === 'string') {
          const methodLower = body.method.toLowerCase();
          if (methodLower === 'ton') {
            method = PaymentMethod.TON;
          } else if (methodLower === 'usdt') {
            method = PaymentMethod.USDT;
          } else if (methodLower === 'telegram_stars') {
            method = PaymentMethod.TELEGRAM_STARS;
          } else {
            method = PaymentMethod.TON; // По умолчанию
          }
        } else {
          method = body.method;
        }
      }
      const transaction = await this.paymentTransactionService.createSubscriptionTransaction(
        user.id,
        body.plan,
        method,
      );

      // Получаем или создаем кошелек пользователя
      const wallet = await this.walletService.getOrCreateWallet(user.id);

      return {
        transactionId: transaction.id,
        walletAddress: wallet.address,
        amount: transaction.amount,
        comment: transaction.comment,
        method: transaction.method,
        status: transaction.status,
        expiresAt: transaction.expiresAt,
        // Инструкции для пользователя
        instructions: {
          ton: `Отправьте ${transaction.amount} TON на адрес ${wallet.address} с комментарием: ${transaction.comment}`,
          usdt: `Отправьте ${transaction.amount} USDT на адрес ${wallet.address} с комментарием: ${transaction.comment}`,
        },
      };
    } catch (error: any) {
      // Если это уже BadRequestException, просто пробрасываем
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Для других ошибок оборачиваем в понятное сообщение
      throw new BadRequestException(error.message || 'Не удалось создать платеж. Попробуйте позже или обратитесь в поддержку.');
    }
  }

  /**
   * Подтвердить платеж (когда пользователь отправил транзакцию)
   */
  @Post('payment/:transactionId/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmPayment(
    @CurrentUser() user: any,
    @Param('transactionId') transactionId: string,
    @Body() body: { txHash: string },
  ) {
    const transaction = await this.paymentTransactionService.updateTransactionHash(transactionId, body.txHash);
    
    // Проверяем статус транзакции только после того, как пользователь ввел хеш
    await this.paymentTransactionService.checkTransactionStatus(transactionId);

    return {
      message: 'Платеж подтвержден, проверяется в блокчейне',
      transactionId: transaction.id,
      status: transaction.status,
    };
  }

  /**
   * Проверить статус платежа
   */
  @Get('payment/:transactionId/status')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(@CurrentUser() user: any, @Param('transactionId') transactionId: string) {
    const transaction = await this.paymentTransactionService.getTransaction(transactionId);

    // Проверяем, что транзакция принадлежит пользователю
    if (transaction.userId !== user.id) {
      throw new BadRequestException('Транзакция не принадлежит пользователю');
    }

    // Проверяем статус в блокчейне только если есть хеш транзакции
    if (transaction.status !== 'completed' && transaction.status !== 'failed' && transaction.txHash) {
      await this.paymentTransactionService.checkTransactionStatus(transactionId);
      // Получаем обновленную транзакцию
      return await this.paymentTransactionService.getTransaction(transactionId);
    }

    return transaction;
  }

  /**
   * Получить адрес кошелька пользователя
   */
  @Get('wallet')
  @UseGuards(JwtAuthGuard)
  async getWallet(@CurrentUser() user: any) {
    const wallet = await this.walletService.getOrCreateWallet(user.id);
    return {
      address: wallet.address,
      balance: await this.walletService.getWalletBalance(user.id),
    };
  }

  @Get('city-autobuild/status')
  @UseGuards(JwtAuthGuard)
  async getCityAutobuildStatus(@CurrentUser() user: any) {
    const hasAutobuild = await this.subscriptionService.hasCityAutobuild(user.id);
    return { hasAutobuild };
  }

  @Post('city-autobuild/purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseCityAutobuild(@CurrentUser() user: any, @Body() body: { paymentMethod: 'usd' | 'nar' }) {
    await this.subscriptionService.purchaseCityAutobuild(user.id, body.paymentMethod);
    return { message: 'Автобилд города успешно активирован' };
  }

  /**
   * Создать транзакцию для покупки NAR-coin через TON/USDT
   */
  @Post('nar-coin/payment/create')
  @UseGuards(JwtAuthGuard)
  async createNarCoinPayment(@CurrentUser() user: any, @Body() body: { amount: number; method?: PaymentMethod | string }) {
    try {
      if (!body.amount || isNaN(body.amount) || body.amount <= 0) {
        throw new BadRequestException('Некорректная сумма платежа. Сумма должна быть больше 0.');
      }

      // Преобразуем строку в enum (если пришла строка с фронтенда)
      let method: PaymentMethod = PaymentMethod.TON;
      if (body.method) {
        if (typeof body.method === 'string') {
          const methodLower = body.method.toLowerCase();
          if (methodLower === 'ton') {
            method = PaymentMethod.TON;
          } else if (methodLower === 'usdt') {
            method = PaymentMethod.USDT;
          } else if (methodLower === 'telegram_stars') {
            method = PaymentMethod.TELEGRAM_STARS;
          } else {
            method = PaymentMethod.TON; // По умолчанию
          }
        } else {
          method = body.method;
        }
      }
      const transaction = await this.paymentTransactionService.createNarCoinTransaction(
        user.id,
        body.amount,
        method,
      );

      // Получаем или создаем кошелек пользователя
      const wallet = await this.walletService.getOrCreateWallet(user.id);

      const settings = await this.adminService.getSystemSettings();
      const tonRate = Number(settings.ton_exchange_rate) || 1000;

      return {
        transactionId: transaction.id,
        walletAddress: wallet.address,
        amount: transaction.amount,
        comment: transaction.comment,
        method: transaction.method,
        status: transaction.status,
        narAmount: transaction.amount * tonRate,
        expiresAt: transaction.expiresAt,
      };
    } catch (error: any) {
      // Если это уже BadRequestException, просто пробрасываем
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Для других ошибок оборачиваем в понятное сообщение
      throw new BadRequestException(error.message || 'Не удалось создать платеж. Попробуйте позже или обратитесь в поддержку.');
    }
  }
}

