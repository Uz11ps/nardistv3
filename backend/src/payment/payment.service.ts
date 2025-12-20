import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface TonPaymentRequest {
  userId: string;
  amount: number; // в TON
  description: string;
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

  constructor(private configService: ConfigService) {
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

      // Здесь можно добавить логику начисления NAR-coin или подписки
      console.log(`Платеж подтвержден: userId=${userId}, amount=${amount}`);
    }

    if (update.message?.successful_payment) {
      // Платеж успешно завершен
      const payload = JSON.parse(update.message.successful_payment.invoice_payload || '{}');
      const userId = payload.userId;
      const amount = update.message.successful_payment.total_amount / 100; // Конвертируем из копеек

      // Начисляем подписку или NAR-coin
      console.log(`Платеж завершен: userId=${userId}, amount=${amount} Stars`);
    }
  }
}

