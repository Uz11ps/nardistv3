import { Controller, Get, Post, Body, UseGuards, Param, NotFoundException, BadRequestException, Query } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PaymentTransactionService } from '../payment/payment-transaction.service';
import { WalletService } from '../payment/wallet.service';
import { PaymentService } from '../payment/payment.service';
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
    private readonly paymentService: PaymentService,
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
    
    // Определяем метод оплаты
    const methodLower = method?.toLowerCase() || 'tribute';
    const isStars = methodLower === 'stars';
    const isTribute = methodLower === 'tribute';
    const currency = isStars ? 'STARS' : 'TRIBUTE';
    
    const getPrice = (planPrices: { tribute?: number; stars?: number }) => {
      // Для STARS используем цену STARS из админки
      if (isStars) {
        return planPrices.stars || 0;
      }
      // Для TRIBUTE не показываем цену (контролируется сервисом Tribute)
      if (isTribute) {
        return null; // Не показываем цену для TRIBUTE
      }
      return 0;
    };
    
    return [
      { 
        id: 'month_1', 
        name: '1 месяц', 
        price: isTribute ? null : Number(getPrice(prices.month_1)), 
        priceTribute: Number(prices.month_1?.tribute || 0),
        priceStars: Number(prices.month_1?.stars || 0),
        currency, 
        badge: 'Попробовать',
        showPrice: !isTribute // Для TRIBUTE не показываем цену
      },
      { 
        id: 'month_3', 
        name: '3 месяца', 
        price: isTribute ? null : Number(getPrice(prices.month_3)), 
        priceTribute: Number(prices.month_3?.tribute || 0),
        priceStars: Number(prices.month_3?.stars || 0),
        currency, 
        badge: 'Оптимально', 
        popular: true,
        showPrice: !isTribute
      },
      { 
        id: 'month_12', 
        name: '1 год', 
        price: isTribute ? null : Number(getPrice(prices.month_12)), 
        priceTribute: Number(prices.month_12?.tribute || 0),
        priceStars: Number(prices.month_12?.stars || 0),
        currency, 
        badge: 'Выгоднее',
        showPrice: !isTribute
      },
    ];
  }

  /**
   * Получить пакеты NAR-coin (используется в Shop.tsx)
   */
  @Get('nar-coin-packages')
  async getNarCoinPackages(@Query('method') method?: string) {
    const packages = await this.adminService.getNarCoinPrices();
    const methodLower = method?.toLowerCase() || 'tribute';
    const isTributeOrStars = methodLower === 'tribute' || methodLower === 'stars';
    const currency = isTributeOrStars ? 'STARS' : (methodLower === 'usdt' ? 'USDT' : 'TON');
    
    return packages.map(pkg => {
      // Для TRIBUTE и STARS используем TON цены
      const price = isTributeOrStars
        ? Number(pkg.priceTon || 0)
        : (methodLower === 'usdt' ? Number(pkg.priceUsdt || 0) : Number(pkg.priceTon || 0));
      
      return {
        amount: pkg.amount,
        price,
        priceTon: Number(pkg.priceTon || 0),
        priceUsdt: Number(pkg.priceUsdt || 0),
        currency
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
      let method: PaymentMethod = PaymentMethod.TRIBUTE;
      if (body.method) {
        if (typeof body.method === 'string') {
          const methodLower = body.method.toLowerCase();
          if (methodLower === 'stars' || methodLower === 'telegram_stars') {
            method = PaymentMethod.TELEGRAM_STARS;
          } else if (methodLower === 'tribute') {
            method = PaymentMethod.TRIBUTE;
          } else {
            method = PaymentMethod.TRIBUTE; // По умолчанию TRIBUTE
          }
        } else {
          method = body.method;
        }
      }
      
      // Если метод оплаты Tribute или Stars, создаем платеж через Telegram WebApp API
      if (method === PaymentMethod.TRIBUTE || method === PaymentMethod.TELEGRAM_STARS) {
        const prices = await this.adminService.getSubscriptionPrices();
        if (!prices) {
          throw new BadRequestException('Цены подписок не установлены. Обратитесь к администратору.');
        }
        
        const planKey = body.plan === SubscriptionPlan.MONTH_1 ? 'month_1' : body.plan === SubscriptionPlan.MONTH_3 ? 'month_3' : 'month_12';
        const planPrices = prices[planKey];
        if (!planPrices) {
          throw new BadRequestException(`Цена для плана ${planKey} не установлена. Обратитесь к администратору.`);
        }
        
        // Для STARS используем цену STARS из админки
        // Для TRIBUTE используем ссылку Tribute из админки
        const amount = method === PaymentMethod.TELEGRAM_STARS
          ? Number(planPrices.stars || 0)
          : Number(planPrices.tribute || 0);
        const planName = body.plan === SubscriptionPlan.MONTH_1 ? '1 месяц' : body.plan === SubscriptionPlan.MONTH_3 ? '3 месяца' : '1 год';
        
        // Для STARS используем прямой метод выплаты боту, для TRIBUTE - ссылку на товар Tribute
        let payment: any;
        if (method === PaymentMethod.TELEGRAM_STARS) {
          payment = await this.paymentService.createStarsPayment({
            userId: user.id,
            amount: amount,
            description: `Премиум подписка ${planName}`,
            type: 'subscription',
          });
        } else {
          // Для TRIBUTE получаем ссылку из админки
          const tributeLink = planPrices.tributeLink || '';
          if (!tributeLink) {
            throw new BadRequestException('Ссылка на товар Tribute не настроена для этого плана. Обратитесь к администратору.');
          }
          payment = await this.paymentService.createTributePayment({
            userId: user.id,
            amount: amount,
            description: `Премиум подписка ${planName}`,
            type: 'subscription',
            tributeLink: tributeLink,
          });
        }

        // Создаем транзакцию для отслеживания
        const transaction = await this.paymentTransactionService.createSubscriptionTransaction(
          user.id,
          body.plan,
          method,
        );

        return {
          transactionId: transaction.id,
          invoice: payment.invoice || null,
          tributeLink: payment.tributeLink || null,
          invoiceId: payment.invoiceId,
          amount: amount,
          method: method === PaymentMethod.TELEGRAM_STARS ? 'STARS' : 'TRIBUTE',
          status: transaction.status,
        };
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
        method: String(transaction.method).toUpperCase(),
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
   * body.amount - количество NAR из пакета
   * body.price - цена в TON/USDT из пакета (устанавливается админом)
   */
  @Post('nar-coin/payment/create')
  @UseGuards(JwtAuthGuard)
  async createNarCoinPayment(@CurrentUser() user: any, @Body() body: { amount: number; price: number; method?: PaymentMethod | string }) {
    try {
      // Явно конвертируем в числа
      const narAmount = Number(body.amount);
      const price = Number(body.price);

      if (isNaN(narAmount) || narAmount <= 0) {
        throw new BadRequestException('Некорректное количество NAR. Количество должно быть больше 0.');
      }

      if (isNaN(price) || price <= 0) {
        throw new BadRequestException(`Некорректная цена. Цена должна быть больше 0. Получено: ${body.price} (тип: ${typeof body.price})`);
      }

      // Преобразуем строку в enum (если пришла строка с фронтенда)
      let method: PaymentMethod = PaymentMethod.TRIBUTE;
      if (body.method) {
        if (typeof body.method === 'string') {
          const methodLower = body.method.toLowerCase();
          if (methodLower === 'stars' || methodLower === 'telegram_stars') {
            method = PaymentMethod.TELEGRAM_STARS;
          } else if (methodLower === 'tribute') {
            method = PaymentMethod.TRIBUTE;
          } else {
            method = PaymentMethod.TRIBUTE; // По умолчанию TRIBUTE
          }
        } else {
          method = body.method;
        }
      }

      // Если метод оплаты Tribute или Stars, создаем платеж через Telegram WebApp API
      if (method === PaymentMethod.TRIBUTE || method === PaymentMethod.TELEGRAM_STARS) {
        let payment: any;
        if (method === PaymentMethod.TELEGRAM_STARS) {
          payment = await this.paymentService.createStarsPayment({
            userId: user.id,
            amount: price,
            description: `Покупка ${narAmount} NAR-coin`,
            type: 'nar_coin',
          });
        } else {
          // Для TRIBUTE получаем ссылку из пакета NAR-coin
          const packages = await this.adminService.getNarCoinPrices();
          const selectedPackage = packages.find((pkg: any) => pkg.amount === narAmount);
          if (!selectedPackage || !selectedPackage.tributeLink) {
            throw new BadRequestException('Ссылка на товар Tribute не настроена для этого пакета. Обратитесь к администратору.');
          }
          payment = await this.paymentService.createTributePayment({
            userId: user.id,
            amount: price,
            description: `Покупка ${narAmount} NAR-coin`,
            type: 'nar_coin',
            tributeLink: selectedPackage.tributeLink,
          });
        }

        // Создаем транзакцию для отслеживания
        const transaction = await this.paymentTransactionService.createNarCoinTransaction(
          user.id,
          price,
          method,
          narAmount,
        );

        return {
          transactionId: transaction.id,
          invoice: payment.invoice || null,
          tributeLink: payment.tributeLink || null,
          invoiceId: payment.invoiceId,
          amount: price,
          method: method === PaymentMethod.TELEGRAM_STARS ? 'STARS' : 'TRIBUTE',
          status: transaction.status,
          narAmount: narAmount,
        };
      }

      // Используем цену из пакета (установленную админом)
      // price - это цена в TON/USDT для данного пакета
      const transaction = await this.paymentTransactionService.createNarCoinTransaction(
        user.id,
        price, // Используем цену из пакета (конвертированную в число)
        method,
        narAmount, // Передаем количество NAR из пакета (конвертированное в число)
      );

      // Получаем или создаем кошелек пользователя
      const wallet = await this.walletService.getOrCreateWallet(user.id);

      return {
        transactionId: transaction.id,
        walletAddress: wallet.address,
        amount: transaction.amount,
        comment: transaction.comment,
        method: String(transaction.method).toUpperCase(),
        status: transaction.status,
        narAmount: narAmount, // Количество NAR из пакета
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

