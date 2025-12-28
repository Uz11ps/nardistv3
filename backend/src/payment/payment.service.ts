import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UsersService } from '../users/users.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { SubscriptionPlan } from '../subscription/subscription.entity';
import { ReferralsService } from '../referrals/referrals.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { PaymentMethod, PaymentStatus } from './payment-transaction.entity';

export interface TonPaymentRequest {
  userId: string;
  amount: number; // в TON
  description: string;
  type?: 'subscription' | 'nar_coin' | 'skin';
  returnUrl?: string;
}

export interface TonPaymentResponse {
  paymentId: string;
  paymentUrl: string;
  qrCode: string;
}

@Injectable()
export class PaymentService {
  private readonly TON_API_URL = 'https://pay.tg';
  private readonly BOT_TOKEN: string;
  private readonly TON_TO_NAR_RATE = 1000; // 1 TON = 1000 NAR

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
    @Inject(forwardRef(() => ReferralsService))
    private referralsService: ReferralsService,
    @Inject(forwardRef(() => PaymentTransactionService))
    private paymentTransactionService: PaymentTransactionService,
  ) {
    this.BOT_TOKEN = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
  }

  /**
   * Создать платеж через Telegram Stars (TON)
   */
  async createTonPayment(request: TonPaymentRequest): Promise<TonPaymentResponse> {
    try {
      // Проверяем наличие токена бота
      if (!this.BOT_TOKEN || this.BOT_TOKEN.trim() === '') {
        throw new Error('Ошибка настройки: токен Telegram бота не настроен на сервере. Обратитесь в поддержку.');
      }

      // Проверяем валидность суммы
      if (!request.amount || request.amount <= 0) {
        throw new Error('Некорректная сумма платежа. Сумма должна быть больше 0.');
      }

      // Создаем инвойс через Telegram Bot API
      const invoiceResponse = await axios.post(
        `https://api.telegram.org/bot${this.BOT_TOKEN}/createInvoiceLink`,
        {
          title: request.description,
          description: request.description,
          payload: JSON.stringify({
            userId: request.userId,
            amount: request.amount,
            type: 'ton_payment',
          }),
          provider_token: '', // Для Stars не нужен
          currency: 'XTR', // Telegram Stars
          prices: [
            {
              label: request.description,
              amount: Math.round(request.amount * 100), // Stars в копейках (1 Star = 100)
            },
          ],
          max_tip_amount: 0,
          suggested_tip_amounts: [],
          provider_data: JSON.stringify({
            userId: request.userId,
            type: request.type || 'nar_coin',
          }),
        },
        {
          timeout: 10000, // 10 секунд таймаут
        },
      );

      // Проверяем ответ от Telegram API
      if (!invoiceResponse.data) {
        throw new Error('Не получен ответ от платежной системы. Попробуйте позже.');
      }

      if (invoiceResponse.data.ok && invoiceResponse.data.result) {
        const paymentLink = invoiceResponse.data.result.invoice_link;
        if (!paymentLink) {
          throw new Error('Платежная система не вернула ссылку для оплаты. Попробуйте позже.');
        }

        return {
          paymentId: invoiceResponse.data.result.invoice_payload || `payment_${Date.now()}`,
          paymentUrl: paymentLink,
          qrCode: paymentLink,
        };
      }

      // Обрабатываем ошибки от Telegram API
      const errorCode = invoiceResponse.data.error_code;
      const errorDescription = invoiceResponse.data.description || 'Неизвестная ошибка';

      if (errorCode === 401) {
        throw new Error('Ошибка авторизации в платежной системе. Обратитесь в поддержку.');
      } else if (errorCode === 400) {
        throw new Error(`Ошибка запроса: ${errorDescription}. Проверьте данные и попробуйте снова.`);
      } else if (errorCode === 429) {
        throw new Error('Слишком много запросов. Подождите немного и попробуйте снова.');
      } else {
        throw new Error(`Ошибка платежной системы: ${errorDescription}. Попробуйте позже или обратитесь в поддержку.`);
      }
    } catch (error: any) {
      // Обработка сетевых ошибок
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new Error('Превышено время ожидания ответа от платежной системы. Проверьте подключение к интернету и попробуйте снова.');
      }

      if (error.response) {
        // Ошибка с ответом от сервера
        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 401) {
          throw new Error('Ошибка авторизации в платежной системе. Обратитесь в поддержку.');
        } else if (status === 400) {
          const description = errorData?.description || errorData?.error || 'Некорректный запрос';
          throw new Error(`Ошибка запроса: ${description}. Проверьте данные и попробуйте снова.`);
        } else if (status === 429) {
          throw new Error('Слишком много запросов к платежной системе. Подождите немного и попробуйте снова.');
        } else if (status >= 500) {
          throw new Error('Платежная система временно недоступна. Попробуйте позже.');
        } else {
          const description = errorData?.description || errorData?.error || error.message || 'Неизвестная ошибка';
          throw new Error(`Ошибка платежной системы: ${description}. Попробуйте позже или обратитесь в поддержку.`);
        }
      }

      // Если ошибка уже имеет понятное сообщение (наше собственное), просто пробрасываем
      if (error.message && error.message.includes('Ошибка')) {
        throw error;
      }

      // Для всех остальных ошибок даем общее сообщение
      console.error('Ошибка создания TON платежа:', error);
      throw new Error(`Не удалось создать платеж. ${error.message || 'Неизвестная ошибка'}. Попробуйте позже или обратитесь в поддержку.`);
    }
  }

  /**
   * Создать платеж через STARS (прямая выплата боту)
   * Возвращает данные инвойса для открытия через WebApp.openInvoice
   */
  async createStarsPayment(request: TonPaymentRequest): Promise<{ invoice: any; invoiceId: string }> {
    try {
      if (!this.BOT_TOKEN || this.BOT_TOKEN.trim() === '') {
        throw new Error('Ошибка настройки: токен Telegram бота не настроен на сервере. Обратитесь в поддержку.');
      }

      if (!request.amount || request.amount <= 0) {
        throw new Error('Некорректная сумма платежа. Сумма должна быть больше 0.');
      }

      // Создаем инвойс через Telegram Bot API для прямой выплаты боту
      const invoiceResponse = await axios.post(
        `https://api.telegram.org/bot${this.BOT_TOKEN}/createInvoiceLink`,
        {
          title: request.description,
          description: request.description,
          payload: JSON.stringify({
            userId: request.userId,
            amount: request.amount,
            type: request.type || 'nar_coin',
            method: 'stars', // Прямая выплата боту
          }),
          provider_token: '', // Для Stars не нужен
          currency: 'XTR', // Telegram Stars
          prices: [
            {
              label: request.description,
              amount: Math.round(request.amount * 100), // Stars в копейках (1 Star = 100)
            },
          ],
          max_tip_amount: 0,
          suggested_tip_amounts: [],
          provider_data: JSON.stringify({
            userId: request.userId,
            type: request.type || 'nar_coin',
            method: 'stars', // Прямая выплата боту
          }),
        },
        {
          timeout: 10000,
        },
      );

      if (!invoiceResponse.data) {
        throw new Error('Не получен ответ от платежной системы. Попробуйте позже.');
      }

      if (!invoiceResponse.data.ok) {
        const errorDescription = invoiceResponse.data.description || invoiceResponse.data.error_code || 'Неизвестная ошибка';
        alert('Ошибка создания STARS инвойса:' + invoiceResponse.data);
        throw new Error(`Ошибка создания инвойса: ${errorDescription}`);
      }

      const result = invoiceResponse.data.result;
      if (!result) {
        alert('Ответ от Telegram API не содержит result: ' +invoiceResponse.data);
        throw new Error('Платежная система вернула некорректный ответ. Попробуйте позже.');
      }

      const invoiceLink = result.invoice_link;
      if (!invoiceLink) {
        alert('Ответ от Telegram API не содержит invoice_link:' + result);
        throw new Error('Платежная система не вернула ссылку для оплаты. Попробуйте позже.');
      }

      const invoiceId = result.invoice_payload || `stars_${Date.now()}`;

      // Извлекаем invoice_id из ссылки для использования в WebApp.openInvoice
      // Формат ссылки: https://t.me/invoice/XXXXX
      const invoiceMatch = invoiceLink.match(/\/invoice\/([^/?]+)/);
      const invoice = invoiceMatch ? invoiceMatch[1] : null;

      if (!invoice) {
        console.error('Не удалось извлечь invoice ID из ссылки:', invoiceLink);
        throw new Error('Не удалось извлечь invoice ID из ссылки');
      }

      return {
        invoice: {
          slug: invoice,
        },
        invoiceId,
      };
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 401) {
          throw new Error('Ошибка авторизации в платежной системе. Обратитесь в поддержку.');
        } else if (status === 400) {
          const description = errorData?.description || errorData?.error || 'Некорректный запрос';
          throw new Error(`Ошибка запроса: ${description}. Проверьте данные и попробуйте снова.`);
        } else if (status >= 500) {
          throw new Error('Платежная система временно недоступна. Попробуйте позже.');
        }
      }

      if (error.message && error.message.includes('Ошибка')) {
        throw error;
      }

      console.error('Ошибка создания STARS платежа:', error);
      throw new Error(`Не удалось создать платеж. ${error.message || 'Неизвестная ошибка'}. Попробуйте позже или обратитесь в поддержку.`);
    }
  }

  /**
   * Создать платеж через Tribute
   * Возвращает ссылку на товар Tribute для открытия в браузере или Mini App
   */
  async createTributePayment(request: TonPaymentRequest & { tributeLink: string }): Promise<{ tributeLink: string; invoiceId: string }> {
    try {
      if (!request.tributeLink || request.tributeLink.trim() === '') {
        throw new Error('Ссылка на товар Tribute не настроена. Обратитесь к администратору.');
      }

      // Проверяем что ссылка валидная (должна быть ссылкой Tribute)
      if (!request.tributeLink.includes('tribute.tg') && !request.tributeLink.includes('t.me/tribute')) {
        throw new Error('Некорректная ссылка на товар Tribute. Проверьте настройки в админке.');
      }

      const invoiceId = `tribute_${Date.now()}_${request.userId}`;

      return {
        tributeLink: request.tributeLink,
        invoiceId,
      };
    } catch (error: any) {
      if (error.message && error.message.includes('Ошибка') || error.message.includes('не настроена') || error.message.includes('Некорректная')) {
        throw error;
      }

      console.error('Ошибка создания Tribute платежа:', error);
      throw new Error(`Не удалось создать платеж. ${error.message || 'Неизвестная ошибка'}. Попробуйте позже или обратитесь в поддержку.`);
    }
  }

  /**
   * Проверить статус платежа
   */
  async checkPaymentStatus(paymentId: string): Promise<{ status: 'pending' | 'paid' | 'failed'; amount?: number }> {
    // В реальности нужно проверять через webhook от Telegram
    // Пока возвращаем pending
    return { status: 'pending' };
  }

  /**
   * Обработать webhook от Telegram (для подтверждения платежа)
   */
  async handlePaymentWebhook(update: any): Promise<void> {
    // Обработка pre_checkout_query (подтверждение платежа перед оплатой)
    if (update.pre_checkout_query) {
      try {
        const payload = JSON.parse(update.pre_checkout_query.invoice_payload || '{}');
        const providerData = JSON.parse(update.pre_checkout_query.provider_data || '{}');
        const method = payload.method || providerData.method || 'stars';
        
        // Для Tribute и Stars всегда подтверждаем платеж
        if (method === 'tribute' || method === 'stars') {
          // Отправляем подтверждение через Bot API
          await axios.post(
            `https://api.telegram.org/bot${this.BOT_TOKEN}/answerPreCheckoutQuery`,
            {
              pre_checkout_query_id: update.pre_checkout_query.id,
              ok: true,
            },
          );
          console.log(`✅ Pre-checkout подтвержден для ${method === 'stars' ? 'STARS' : 'Tribute'} платежа`);
        }
      } catch (error) {
        console.error('Ошибка обработки pre_checkout_query:', error);
      }
    }

    // Обработка успешного платежа
    if (update.message?.successful_payment) {
      try {
        const payload = JSON.parse(update.message.successful_payment.invoice_payload || '{}');
        const providerData = JSON.parse(update.message.successful_payment.provider_data || '{}');
        const userId = payload.userId || providerData.userId;
        const type = payload.type || providerData.type || 'nar_coin';
        const method = payload.method || providerData.method || 'tribute';
        const amount = update.message.successful_payment.total_amount / 100; // Конвертируем из копеек (Stars)
        
        // Конвертируем Stars в TON (1 Star = 1 TON примерно)
        const tonAmount = amount;
        const narAmount = tonAmount * this.TON_TO_NAR_RATE;

        // Если это платеж через Tribute или Stars, обновляем транзакцию
        if (method === 'tribute' || method === 'stars') {
          // Ищем транзакцию по invoice payload (сохраняем invoiceId в metadata при создании)
          // Для упрощения используем invoice payload как идентификатор
          const invoiceId = payload.invoiceId || update.message.successful_payment.invoice_payload;
          
          // Находим транзакцию по userId и методу TRIBUTE со статусом PENDING
          const transactions = await this.paymentTransactionService.findTransactionsByUserAndMethod(
            userId,
            PaymentMethod.TRIBUTE,
          );
          
          // Находим подходящую транзакцию (по типу, сумме и методу)
          const expectedMethod = method === 'stars' ? PaymentMethod.TELEGRAM_STARS : PaymentMethod.TRIBUTE;
          const transaction = transactions.find(
            (t) => 
              t.status === PaymentStatus.PENDING &&
              t.method === expectedMethod &&
              ((type === 'subscription' && t.type === 'subscription') ||
               (type === 'nar_coin' && t.type === 'nar_coin')) &&
              Math.abs(Number(t.amount) - tonAmount) < 0.1, // Погрешность 0.1 TON
          );

          if (transaction) {
            // Обновляем транзакцию как завершенную
            transaction.status = PaymentStatus.COMPLETED;
            transaction.confirmedAt = new Date();
            transaction.metadata = {
              ...transaction.metadata,
              invoiceId,
              telegramPaymentId: update.message.successful_payment.telegram_payment_charge_id,
            };
            await this.paymentTransactionService.updateTransaction(transaction);
            
            // Обрабатываем завершенную транзакцию
            await this.paymentTransactionService.processCompletedTransaction(transaction);
            console.log(`✅ Tribute платеж обработан: transactionId=${transaction.id}, userId=${userId}`);
            return;
          }
        }

        // Старая логика для обратной совместимости (если транзакция не найдена)
        if (type === 'subscription') {
          // Определяем план подписки по сумме
          let plan: SubscriptionPlan;
          if (tonAmount >= 22) {
            plan = SubscriptionPlan.MONTH_12;
          } else if (tonAmount >= 7) {
            plan = SubscriptionPlan.MONTH_3;
          } else {
            plan = SubscriptionPlan.MONTH_1;
          }
          
          await this.subscriptionService.createSubscription(userId, plan);
          console.log(`Подписка активирована: userId=${userId}, plan=${plan}`);
          
          // Начисляем реферальный бонус (если есть реферер)
          await this.referralsService.processReferralBonus(userId, narAmount, `Подписка ${plan}`);
        } else {
          // Начисляем NAR-coin
          const user = await this.usersService.findOne(userId);
          const currentBalance = Number(user.narCoin || 0);
          await this.usersService.update(userId, { narCoin: currentBalance + narAmount });
          console.log(`NAR-coin начислены: userId=${userId}, amount=${narAmount} NAR (${tonAmount} TON)`);
          
          // Начисляем реферальный бонус (если есть реферер)
          await this.referralsService.processReferralBonus(userId, narAmount, 'Покупка NAR-coin');
        }
      } catch (error) {
        console.error(`Ошибка обработки платежа:`, error);
        throw error;
      }
    }
  }
}

