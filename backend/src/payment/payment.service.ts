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
    // Используем Telegram Stars API для оплаты
    // В реальности нужно использовать Telegram Bot API для создания инвойса
    
    try {
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
      );

      if (invoiceResponse.data.ok) {
        return {
          paymentId: invoiceResponse.data.result.invoice_payload || `payment_${Date.now()}`,
          paymentUrl: invoiceResponse.data.result.invoice_link,
          qrCode: invoiceResponse.data.result.invoice_link, // Можно сгенерировать QR из ссылки
        };
      }

      throw new Error('Не удалось создать платеж');
    } catch (error: any) {
      console.error('Ошибка создания TON платежа:', error.response?.data || error.message);
      throw new Error('Ошибка создания платежа: ' + (error.response?.data?.description || error.message));
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

