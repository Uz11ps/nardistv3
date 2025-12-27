import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UsersService } from '../users/users.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { SubscriptionPlan } from '../subscription/subscription.entity';
import { ReferralsService } from '../referrals/referrals.service';

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
    if (update.pre_checkout_query) {
      // Подтверждаем платеж
      const payload = JSON.parse(update.pre_checkout_query.invoice_payload || '{}');
      const userId = payload.userId;
      const amount = payload.amount;

      console.log(`Платеж подтвержден: userId=${userId}, amount=${amount}`);
    }

    if (update.message?.successful_payment) {
      // Платеж успешно завершен
      const payload = JSON.parse(update.message.successful_payment.invoice_payload || '{}');
      const providerData = JSON.parse(update.message.successful_payment.provider_data || '{}');
      const userId = payload.userId || providerData.userId;
      const type = payload.type || providerData.type || 'nar_coin';
      const amount = update.message.successful_payment.total_amount / 100; // Конвертируем из копеек (Stars)
      
      // Конвертируем Stars в TON (1 Star = 1 TON примерно)
      const tonAmount = amount;
      const narAmount = tonAmount * this.TON_TO_NAR_RATE;

      try {
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
        console.error(`Ошибка обработки платежа: userId=${userId}`, error);
        throw error;
      }
    }
  }
}

