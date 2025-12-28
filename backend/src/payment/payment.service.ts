import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { SubscriptionPlan } from '../subscription/subscription.entity';
import { ReferralsService } from '../referrals/referrals.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { PaymentMethod, PaymentStatus } from './payment-transaction.entity';

export interface PaymentRequest {
  userId: string;
  amount?: number; // в Stars (не требуется для Tribute)
  description: string;
  type?: 'subscription' | 'nar_coin' | 'skin';
  returnUrl?: string;
}

export interface PaymentResponse {
  paymentId: string;
  paymentUrl: string;
  qrCode: string;
}

@Injectable()
export class PaymentService {
  private readonly BOT_TOKEN: string;
  private readonly TRIBUTE_API_KEY: string;

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
    this.TRIBUTE_API_KEY = this.configService.get<string>('TRIBUTE_API_KEY') || '';
  }

  /**
   * Проверить наличие API ключа Tribute
   */
  hasTributeApiKey(): boolean {
    return !!this.TRIBUTE_API_KEY && this.TRIBUTE_API_KEY.trim() !== '';
  }

  /**
   * Проверить подпись webhook от Tribute
   * Tribute использует HMAC-SHA256 подпись в заголовке trbt-signature
   * Подпись вычисляется от raw JSON body (строки)
   */
  verifyTributeWebhookSignature(body: string, signature: string): boolean {
    if (!this.TRIBUTE_API_KEY) {
      console.warn('⚠️ TRIBUTE_API_KEY не настроен, пропускаем проверку подписи');
      console.warn('   Для безопасности рекомендуется настроить TRIBUTE_API_KEY в .env');
      return true; // Если ключ не настроен, пропускаем проверку (для обратной совместимости)
    }

    if (!signature) {
      console.error('❌ Tribute webhook: отсутствует подпись в заголовке trbt-signature');
      return false;
    }

    try {
      // Вычисляем ожидаемую подпись через HMAC-SHA256
      // Tribute использует API ключ как секретный ключ для HMAC
      const expectedSignature = crypto
        .createHmac('sha256', this.TRIBUTE_API_KEY)
        .update(body, 'utf8')
        .digest('hex');

      // Нормализуем полученную подпись (убираем пробелы, приводим к нижнему регистру)
      const receivedSignature = signature.trim().toLowerCase();
      const expectedSignatureLower = expectedSignature.toLowerCase();

      // Сравниваем подписи (защита от timing attacks)
      // Обе подписи должны быть в hex формате
      if (receivedSignature.length !== expectedSignatureLower.length) {
        console.error('❌ Tribute webhook: длина подписи не совпадает', {
          receivedLength: receivedSignature.length,
          expectedLength: expectedSignatureLower.length,
        });
        return false;
      }

      const isValid = crypto.timingSafeEqual(
        Buffer.from(receivedSignature, 'hex'),
        Buffer.from(expectedSignatureLower, 'hex'),
      );

      if (!isValid) {
        console.error('❌ Tribute webhook: неверная подпись', {
          received: receivedSignature.substring(0, 16) + '...',
          expected: expectedSignatureLower.substring(0, 16) + '...',
        });
      } else {
        console.log('✅ Подпись Tribute webhook валидна');
      }

      return isValid;
    } catch (error) {
      console.error('❌ Ошибка проверки подписи Tribute webhook:', error);
      // Если ошибка при парсинге hex, возможно подпись в другом формате
      if (error instanceof Error && error.message.includes('hex')) {
        console.error('   Возможно, подпись не в hex формате. Проверьте документацию Tribute.');
      }
      return false;
    }
  }

  /**
   * Создать платеж через Telegram Stars
   */
  async createTonPayment(request: PaymentRequest): Promise<PaymentResponse> {
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
            type: 'payment',
          }),
          provider_token: '', // Для Stars не нужен
          currency: 'XTR', // Telegram Stars
          prices: [
            {
              label: request.description,
              amount: Math.round(request.amount), // Для Stars (XTR) amount указывается напрямую в Stars (не в копейках)
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
      console.error('Ошибка создания платежа:', error);
      throw new Error(`Не удалось создать платеж. ${error.message || 'Неизвестная ошибка'}. Попробуйте позже или обратитесь в поддержку.`);
    }
  }

  /**
   * Создать платеж через STARS (прямая выплата боту)
   * Возвращает данные инвойса для открытия через WebApp.openInvoice
   */
  async createStarsPayment(request: PaymentRequest): Promise<{ invoice: any; invoiceId: string }> {
    try {
      if (!this.BOT_TOKEN || this.BOT_TOKEN.trim() === '') {
        throw new Error('Ошибка настройки: токен Telegram бота не настроен на сервере. Обратитесь в поддержку.');
      }

      if (!request.amount || request.amount <= 0) {
        throw new Error('Некорректная сумма платежа. Сумма должна быть больше 0.');
      }

      // Создаем инвойс через Telegram Bot API для прямой выплаты боту
      const invoicePayload = {
        title: request.description,
        description: request.description,
        payload: JSON.stringify({
          userId: request.userId,
          amount: request.amount,
          type: request.type || 'nar_coin',
          method: 'stars',
        }),
        provider_token: '', // Для Stars не нужен
        currency: 'XTR', // Telegram Stars
        prices: [
          {
            label: request.description,
            amount: Math.round(request.amount), // Для Stars (XTR) amount указывается напрямую в Stars (не в копейках)
          },
        ],
        max_tip_amount: 0,
        suggested_tip_amounts: [],
        provider_data: JSON.stringify({
          userId: request.userId,
          type: request.type || 'nar_coin',
          method: 'stars',
        }),
      };

      console.log('📤 Создание STARS инвойса:', {
        url: `https://api.telegram.org/bot${this.BOT_TOKEN.substring(0, 10)}.../createInvoiceLink`,
        payload: { ...invoicePayload, provider_token: '[HIDDEN]' },
      });

      const invoiceResponse = await axios.post(
        `https://api.telegram.org/bot${this.BOT_TOKEN}/createInvoiceLink`,
        invoicePayload,
        {
          timeout: 10000,
        },
      );

      console.log('📥 Ответ от Telegram API:', {
        ok: invoiceResponse.data?.ok,
        error_code: invoiceResponse.data?.error_code,
        description: invoiceResponse.data?.description,
        has_result: !!invoiceResponse.data?.result,
        result_keys: invoiceResponse.data?.result ? Object.keys(invoiceResponse.data.result) : [],
      });

      if (!invoiceResponse.data) {
        console.error('❌ Telegram API не вернул данные');
        throw new Error('Не получен ответ от платежной системы. Попробуйте позже.');
      }

      if (!invoiceResponse.data.ok) {
        const errorCode = invoiceResponse.data.error_code;
        const errorDescription = invoiceResponse.data.description || 'Неизвестная ошибка';
        console.error('❌ Ошибка создания STARS инвойса:', {
          error_code: errorCode,
          description: errorDescription,
          full_response: invoiceResponse.data,
        });

        // Специальные сообщения для частых ошибок
        if (errorCode === 400) {
          throw new Error(`Некорректный запрос: ${errorDescription}. Проверьте настройки бота для Stars платежей.`);
        } else if (errorCode === 401) {
          throw new Error('Ошибка авторизации. Проверьте токен бота.');
        } else {
          throw new Error(`Ошибка создания инвойса: ${errorDescription} (код: ${errorCode})`);
        }
      }

      const result = invoiceResponse.data.result;
      if (!result) {
        console.error('❌ Ответ от Telegram API не содержит result:', invoiceResponse.data);
        throw new Error('Платежная система вернула некорректный ответ. Попробуйте позже.');
      }

      // Telegram API может вернуть ссылку в разных форматах:
      // 1. В поле invoice_link объекта result: https://t.me/invoice/XXXXX
      // 2. Сам result как строка: https://t.me/$XXXXX (новый формат для Stars)
      let invoiceLink: string | null = null;
      
      if (typeof result === 'string') {
        // Новый формат: result - это прямая ссылка
        invoiceLink = result;
      } else if (result.invoice_link) {
        // Старый формат: ссылка в поле invoice_link
        invoiceLink = result.invoice_link;
      } else {
        // Ищем ссылку в других полях объекта
        for (const key of Object.keys(result)) {
          if (typeof result[key] === 'string' && result[key].startsWith('https://t.me/')) {
            invoiceLink = result[key];
            break;
          }
        }
      }

      if (!invoiceLink) {
        console.error('❌ Ответ от Telegram API не содержит ссылку:', {
          result_keys: typeof result === 'object' ? Object.keys(result) : 'N/A (string)',
          result: result,
          result_type: typeof result,
        });
        throw new Error('Платежная система не вернула ссылку для оплаты. Убедитесь, что бот настроен для приема Stars платежей.');
      }

      const invoiceId = result.invoice_payload || `stars_${Date.now()}`;

      // Извлекаем invoice slug из ссылки для использования в WebApp.openInvoice
      // Форматы ссылок:
      // 1. https://t.me/invoice/XXXXX - старый формат
      // 2. https://t.me/$XXXXX - новый формат для Stars
      let invoice: string | null = null;
      
      // Пробуем извлечь из старого формата
      const invoiceMatch = invoiceLink.match(/\/invoice\/([^/?]+)/);
      if (invoiceMatch) {
        invoice = invoiceMatch[1];
      } else {
        // Пробуем извлечь из нового формата (https://t.me/$XXXXX)
        const newFormatMatch = invoiceLink.match(/\/\$([^/?]+)/);
        if (newFormatMatch) {
          invoice = newFormatMatch[1];
        } else {
          // Если не удалось извлечь, используем всю ссылку после последнего /
          const lastSlashIndex = invoiceLink.lastIndexOf('/');
          if (lastSlashIndex !== -1) {
            invoice = invoiceLink.substring(lastSlashIndex + 1);
            // Убираем $ если есть
            if (invoice.startsWith('$')) {
              invoice = invoice.substring(1);
            }
          }
        }
      }

      if (!invoice) {
        console.error('❌ Не удалось извлечь invoice slug из ссылки:', invoiceLink);
        throw new Error('Не удалось извлечь invoice slug из ссылки');
      }

      console.log('✅ STARS инвойс создан успешно:', {
        invoice_link: invoiceLink.substring(0, 50) + '...',
        invoice_slug: invoice,
        invoice_id: invoiceId,
      });

      // Для Stars платежей с форматом https://t.me/$XXXXX
      // WebApp.openInvoice требует slug с префиксом $
      // Убеждаемся, что slug начинается с $
      const invoiceSlug = invoice.startsWith('$') ? invoice : `$${invoice}`;
      
      return {
        invoice: {
          slug: invoiceSlug, // Slug с префиксом $ для WebApp.openInvoice
          url: invoiceLink, // Полная ссылка для Stars
        },
        invoiceId,
      };
    } catch (error: any) {
      console.error('❌ Исключение при создании STARS платежа:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack?.substring(0, 500),
      });

      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 401) {
          throw new Error('Ошибка авторизации в платежной системе. Проверьте токен бота.');
        } else if (status === 400) {
          const description = errorData?.description || errorData?.error || 'Некорректный запрос';
          const errorCode = errorData?.error_code;
          throw new Error(`Ошибка запроса: ${description}${errorCode ? ` (код: ${errorCode})` : ''}. Проверьте настройки бота для Stars платежей.`);
        } else if (status >= 500) {
          throw new Error('Платежная система временно недоступна. Попробуйте позже.');
        }
      }

      if (error.message && error.message.includes('Ошибка')) {
        throw error;
      }

      throw new Error(`Не удалось создать платеж. ${error.message || 'Неизвестная ошибка'}. Проверьте логи сервера для деталей.`);
    }
  }

  /**
   * Создать платеж через Tribute
   * Возвращает ссылку на товар Tribute для открытия в браузере или Mini App
   */
  async createTributePayment(request: PaymentRequest & { tributeLink: string }): Promise<{ tributeLink: string; invoiceId: string }> {
    try {
      // Для Tribute не нужна цена - только ссылка на товар
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
   * Обработать webhook от Telegram или Tribute (для подтверждения платежа)
   */
  async handlePaymentWebhook(update: any): Promise<void> {
    // Проверяем, это webhook от Tribute или от Telegram
    // Tribute обычно отправляет данные в формате { event: 'payment.completed', data: {...} }
    if (update.event === 'payment.completed' || update.type === 'payment.completed' || update.payment) {
      // Это webhook от Tribute
      await this.handleTributeWebhook(update);
      return;
    }
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
        // Для Stars (XTR) total_amount уже в Stars (не нужно делить на 100)
        const amount = update.message.successful_payment.total_amount;
        const starsAmount = amount;

        // Если это платеж через Tribute или Stars, обновляем транзакцию
        if (method === 'tribute' || method === 'stars') {
          // Ищем транзакцию по invoice payload (сохраняем invoiceId в metadata при создании)
          // Для упрощения используем invoice payload как идентификатор
          const invoiceId = payload.invoiceId || update.message.successful_payment.invoice_payload;
          
          // Определяем метод платежа
          const expectedMethod = method === 'stars' ? PaymentMethod.TELEGRAM_STARS : PaymentMethod.TRIBUTE;
          
          // Находим транзакцию по userId и методу со статусом PENDING
          const transactions = await this.paymentTransactionService.findTransactionsByUserAndMethod(
            userId,
            expectedMethod,
          );
          const transaction = transactions.find(
            (t) => 
              t.status === PaymentStatus.PENDING &&
              t.method === expectedMethod &&
              ((type === 'subscription' && t.type === 'subscription') ||
               (type === 'nar_coin' && t.type === 'nar_coin')) &&
              Math.abs(Number(t.amount) - starsAmount) < 0.1, // Погрешность 0.1 Stars
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
            
            // Обрабатываем завершенную транзакцию (narAmount берется из metadata транзакции)
            await this.paymentTransactionService.processCompletedTransaction(transaction);
            console.log(`✅ Платеж обработан: transactionId=${transaction.id}, userId=${userId}, method=${method}`);
            return;
          }
        }
      } catch (error) {
        console.error(`Ошибка обработки платежа:`, error);
        throw error;
      }
    }
  }

  /**
   * Обработать webhook от Tribute
   */
  private async handleTributeWebhook(webhook: any): Promise<void> {
    try {
      console.log('📥 Получен Tribute webhook:', JSON.stringify(webhook, null, 2));
      
      // Формат webhook от Tribute может быть разным, обрабатываем основные варианты
      const paymentData = webhook.data || webhook.payment || webhook;
      const userId = paymentData.userId || paymentData.user_id || paymentData.metadata?.userId || paymentData.user?.id;
      const amount = paymentData.amount || paymentData.total_amount || 0;
      const transactionId = paymentData.transactionId || paymentData.transaction_id || paymentData.id;
      const type = paymentData.type || paymentData.metadata?.type || 'subscription';
      
      console.log('🔍 Парсинг Tribute webhook:', { userId, amount, transactionId, type });
      
      if (!userId) {
        console.error('❌ Tribute webhook: userId не найден', webhook);
        return;
      }

      // Ищем транзакцию по userId и методу TRIBUTE со статусом PENDING
      const transactions = await this.paymentTransactionService.findTransactionsByUserAndMethod(
        userId,
        PaymentMethod.TRIBUTE,
      );

      console.log(`🔍 Найдено ${transactions.length} транзакций TRIBUTE для userId=${userId}`);
      console.log(`   Тип искомой транзакции: ${type}`);
      console.log(`   Доступные транзакции:`, transactions.map(t => ({
        id: t.id,
        status: t.status,
        type: t.type,
        method: t.method,
        createdAt: t.createdAt,
        subscriptionPlan: t.subscriptionPlan,
      })));

      // Находим подходящую транзакцию (берем самую свежую PENDING транзакцию нужного типа)
      const matchingTransactions = transactions.filter(
        (t) => 
          t.status === PaymentStatus.PENDING &&
          t.method === PaymentMethod.TRIBUTE &&
          ((type === 'subscription' && t.type === 'subscription') ||
           (type === 'nar_coin' && t.type === 'nar_coin')),
      );
      
      console.log(`   Подходящих транзакций: ${matchingTransactions.length}`);
      
      const transaction = matchingTransactions
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]; // Берем самую свежую

      if (transaction) {
        console.log(`✅ Найдена транзакция для обработки: transactionId=${transaction.id}, type=${transaction.type}`);
        
        // Обновляем транзакцию как завершенную
        transaction.status = PaymentStatus.COMPLETED;
        transaction.confirmedAt = new Date();
        transaction.metadata = {
          ...transaction.metadata,
          tributeTransactionId: transactionId,
          tributeWebhook: webhook,
        };
        await this.paymentTransactionService.updateTransaction(transaction);
        
        console.log(`🔄 Обрабатываю завершенную транзакцию: transactionId=${transaction.id}`);
        
        // Обрабатываем завершенную транзакцию (создает подписку или начисляет NAR-coin)
        await this.paymentTransactionService.processCompletedTransaction(transaction);
        
        console.log(`✅ Tribute платеж обработан через webhook: transactionId=${transaction.id}, userId=${userId}, type=${type}`);
      } else {
        console.warn(`⚠️ Tribute webhook: транзакция не найдена для userId=${userId}, type=${type}`);
        console.warn(`   Доступные транзакции:`, transactions.map(t => ({
          id: t.id,
          status: t.status,
          type: t.type,
          method: t.method,
          createdAt: t.createdAt,
        })));
      }
    } catch (error) {
      console.error('❌ Ошибка обработки Tribute webhook:', error);
      throw error;
    }
  }
}

