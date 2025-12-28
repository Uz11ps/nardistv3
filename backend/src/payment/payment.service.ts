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
    
    // Читаем TRIBUTE_API_KEY из конфигурации
    const tributeApiKeyRaw = this.configService.get<string>('TRIBUTE_API_KEY');
    this.TRIBUTE_API_KEY = tributeApiKeyRaw || '';
    
    // Логируем для отладки (не показываем полный ключ)
    if (this.TRIBUTE_API_KEY) {
      const keyPreview = this.TRIBUTE_API_KEY.length > 10 
        ? `${this.TRIBUTE_API_KEY.substring(0, 10)}...` 
        : '***';
      console.log(`✅ TRIBUTE_API_KEY загружен из конфигурации (длина: ${this.TRIBUTE_API_KEY.length}, превью: ${keyPreview})`);
    } else {
      console.warn(`⚠️ TRIBUTE_API_KEY не найден в конфигурации`);
      console.warn(`   Проверьте, что переменная TRIBUTE_API_KEY установлена в .env файле`);
      console.warn(`   Сырое значение из configService: ${tributeApiKeyRaw === undefined ? 'undefined' : tributeApiKeyRaw === null ? 'null' : `"${tributeApiKeyRaw}"`}`);
    }
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
    // Детальная проверка наличия ключа
    const hasKey = !!this.TRIBUTE_API_KEY && this.TRIBUTE_API_KEY.trim() !== '';
    
    if (!hasKey) {
      console.warn('⚠️ TRIBUTE_API_KEY не настроен, пропускаем проверку подписи');
      console.warn(`   Значение ключа: ${this.TRIBUTE_API_KEY === '' ? 'пустая строка' : this.TRIBUTE_API_KEY === undefined ? 'undefined' : this.TRIBUTE_API_KEY === null ? 'null' : `"${this.TRIBUTE_API_KEY}"`}`);
      console.warn('   Для безопасности рекомендуется настроить TRIBUTE_API_KEY в .env');
      return true; // Если ключ не настроен, пропускаем проверку (для обратной совместимости)
    }
    
    console.log(`✅ TRIBUTE_API_KEY найден, проверяю подпись (длина ключа: ${this.TRIBUTE_API_KEY.length})`);

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
    console.log('🔄 ========== handlePaymentWebhook ВЫЗВАН ==========');
    console.log('🔄 Тип webhook:', {
      hasEvent: !!update.event,
      event: update.event,
      hasType: !!update.type,
      type: update.type,
      hasPayment: !!update.payment,
      hasPreCheckoutQuery: !!update.pre_checkout_query,
      hasMessage: !!update.message,
      keys: Object.keys(update),
    });
    
    // Проверяем, это webhook от Tribute или от Telegram
    // Tribute может отправлять данные в разных форматах:
    // 1. { name: 'new_digital_product', payload: { user_id, telegram_user_id, ... } }
    // 2. { event: 'payment.completed', data: {...} }
    // 3. { type: 'payment.completed', ... }
    // 4. { payment: {...} }
    // 5. Прямой формат с полями userId, amount и т.д.
    
    const isTributeWebhook = 
      update.name === 'new_digital_product' ||
      (update.name && update.name.includes('product')) ||
      update.event === 'payment.completed' || 
      update.type === 'payment.completed' || 
      update.payment ||
      (update.data && (update.data.userId || update.data.user_id)) ||
      (update.payload && (update.payload.telegram_user_id || update.payload.user_id)) ||
      (update.userId || update.user_id) ||
      (update.event && update.event.includes('payment')) ||
      (update.type && update.type.includes('payment'));
    
    if (isTributeWebhook) {
      console.log('✅ Определен как Tribute webhook, вызываю handleTributeWebhook');
      console.log('✅ Причина определения:', {
        hasName: update.name === 'new_digital_product',
        hasEvent: update.event === 'payment.completed',
        hasType: update.type === 'payment.completed',
        hasPayment: !!update.payment,
        hasPayload: !!update.payload,
        hasDataWithUserId: !!(update.data && (update.data.userId || update.data.user_id)),
        hasDirectUserId: !!(update.userId || update.user_id),
      });
      // Это webhook от Tribute
      await this.handleTributeWebhook(update);
      console.log('✅ handleTributeWebhook завершен');
      return;
    }
    
    console.log('🔄 Не Tribute webhook, проверяю другие типы...');
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
          const telegramPaymentId = update.message.successful_payment.telegram_payment_charge_id;

          // ПРОВЕРКА: Не была ли эта транзакция уже обработана
          if (telegramPaymentId) {
            const existingTransaction = await this.paymentTransactionService.findByExternalId(telegramPaymentId);
            if (existingTransaction) {
              console.warn(`⚠️ Telegram Stars: транзакция ${telegramPaymentId} уже была обработана (ID: ${existingTransaction.id})`);
              return;
            }
          }
          
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
            // Сохраняем telegram_payment_charge_id в txHash для предотвращения повторной обработки
            transaction.txHash = telegramPaymentId;
            transaction.metadata = {
              ...transaction.metadata,
              invoiceId,
              telegramPaymentId: telegramPaymentId,
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
      console.log('📥 ========== TRIBUTE WEBHOOK ПОЛУЧЕН ==========');
      console.log('📥 Полный webhook:', JSON.stringify(webhook, null, 2));
      
      // Формат webhook от Tribute может быть разным:
      // 1. { name: 'new_digital_product', payload: { telegram_user_id, user_id, ... } }
      // 2. { event: 'payment.completed', data: { userId, ... } }
      // 3. { payment: { userId, ... } }
      
      let userId: string | null = null;
      let telegramUserId: string | number | null = null;
      const paymentData = webhook.payload || webhook.data || webhook.payment || webhook;
      
      // Пытаемся найти userId разными способами
      if (webhook.payload) {
        // Новый формат: { name: 'new_digital_product', payload: { telegram_user_id, ... } }
        telegramUserId = webhook.payload.telegram_user_id || webhook.payload.telegramUserId;
        const tributeUserId = webhook.payload.user_id || webhook.payload.userId;
        
        console.log('🔍 Формат webhook: new_digital_product');
        console.log('🔍 telegram_user_id:', telegramUserId);
        console.log('🔍 user_id (Tribute):', tributeUserId);
        
        // Если есть telegram_user_id, ищем пользователя по нему
        if (telegramUserId) {
          const user = await this.usersService.findByTelegramId(String(telegramUserId));
          if (user) {
            userId = user.id;
            console.log(`✅ Пользователь найден по telegram_user_id: ${telegramUserId} -> userId: ${userId}`);
          } else {
            console.error(`❌ Пользователь не найден по telegram_user_id: ${telegramUserId}`);
          }
        }
      }
      
      // Если userId не найден, пробуем другие варианты
      if (!userId) {
        userId = paymentData.userId || paymentData.user_id || paymentData.metadata?.userId || paymentData.user?.id;
      }
      
      const amount = paymentData.amount || paymentData.total_amount || webhook.payload?.amount || 0;
      const tributeTransactionId = paymentData.transactionId || paymentData.transaction_id || paymentData.id || webhook.payload?.transaction_id || webhook.payload?.purchase_id;
      
      if (tributeTransactionId) {
        // Проверяем, не была ли эта транзакция уже обработана (по txHash)
        const existingTransaction = await this.paymentTransactionService.findByExternalId(String(tributeTransactionId));
        if (existingTransaction) {
          console.warn(`⚠️ Tribute webhook: транзакция ${tributeTransactionId} уже была обработана (ID: ${existingTransaction.id})`);
          return;
        }
      }

      // Определяем тип: subscription или nar_coin
      // В новом формате можно определить по product_name, product_id или другим полям
      let type = paymentData.type || paymentData.metadata?.type;
      
      // Пытаемся определить тип по product_name
      if (webhook.payload?.product_name) {
        const productName = webhook.payload.product_name.toLowerCase();
        console.log(`🔍 Определение типа по product_name: "${productName}"`);
        
        if (productName.includes('month') || productName.includes('подписка') || productName.includes('subscription') || 
            productName.includes('месяц') || productName.includes('год') || productName.includes('year')) {
          type = 'subscription';
          console.log('✅ Определен тип: subscription (по product_name)');
        } else if (productName.includes('nar') || productName.includes('coin') || productName.includes('монет')) {
          type = 'nar_coin';
          console.log('✅ Определен тип: nar_coin (по product_name)');
        }
      }
      
      // Если тип не определен, пробуем найти любую PENDING транзакцию TRIBUTE
      // и определить тип по ней
      if (!type) {
        console.log('⚠️ Тип не определен из webhook, будем искать по транзакциям');
      }
      
      console.log('🔍 Парсинг Tribute webhook:', { 
        userId, 
        telegramUserId, 
        amount, 
        tributeTransactionId, 
        type,
        productName: webhook.payload?.product_name,
        productId: webhook.payload?.product_id,
      });
      console.log('🔍 paymentData:', JSON.stringify(paymentData, null, 2));
      
      if (!userId) {
        console.error('❌ Tribute webhook: userId не найден в webhook');
        console.error('❌ Доступные поля в paymentData:', Object.keys(paymentData));
        console.error('❌ Доступные поля в webhook:', Object.keys(webhook));
        if (telegramUserId) {
          console.error(`❌ telegram_user_id найден (${telegramUserId}), но пользователь не найден в БД`);
        }
        return;
      }
      
      console.log(`✅ userId найден: ${userId}`);

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

      // Находим подходящую транзакцию
      // Важно: учитываем только недавние транзакции (созданные в последние 2 часа)
      // и только те, которые еще не были обработаны (нет txHash и статус PENDING)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      let matchingTransactions: any[] = [];
      
      if (type) {
        // Если тип определен, ищем транзакции этого типа
        matchingTransactions = transactions.filter(
          (t) => 
            t.status === PaymentStatus.PENDING &&
            t.method === PaymentMethod.TRIBUTE &&
            !t.txHash && // Транзакция еще не была обработана
            t.createdAt >= twoHoursAgo && // Транзакция создана недавно
            ((type === 'subscription' && t.type === 'subscription') ||
             (type === 'nar_coin' && t.type === 'nar_coin')),
        );
        console.log(`   Подходящих транзакций типа ${type} (недавних и необработанных): ${matchingTransactions.length}`);
      } else {
        // Если тип не определен, ищем любую PENDING транзакцию TRIBUTE
        matchingTransactions = transactions.filter(
          (t) => 
            t.status === PaymentStatus.PENDING &&
            t.method === PaymentMethod.TRIBUTE &&
            !t.txHash && // Транзакция еще не была обработана
            t.createdAt >= twoHoursAgo, // Транзакция создана недавно
        );
        console.log(`   Подходящих PENDING транзакций TRIBUTE (недавних и необработанных): ${matchingTransactions.length}`);
      }
      
      // Берем самую свежую транзакцию
      const transaction = matchingTransactions
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      
      // Если тип не был определен, определяем его по найденной транзакции
      if (!type && transaction) {
        type = transaction.type;
        console.log(`✅ Тип определен по транзакции: ${type}`);
      }

      if (transaction) {
        // Дополнительная проверка: убеждаемся, что транзакция еще не обработана
        if (transaction.status !== PaymentStatus.PENDING) {
          console.warn(`⚠️ Транзакция ${transaction.id} уже обработана (статус: ${transaction.status}), пропускаем`);
          return;
        }
        
        if (transaction.txHash) {
          console.warn(`⚠️ Транзакция ${transaction.id} уже имеет txHash (${transaction.txHash}), пропускаем`);
          return;
        }
        
        console.log(`✅ ========== НАЙДЕНА ТРАНЗАКЦИЯ ДЛЯ ОБРАБОТКИ ==========`);
        console.log(`✅ transactionId=${transaction.id}, type=${transaction.type}`);
        if (transaction.type === 'subscription') {
          console.log(`✅ План подписки: ${transaction.subscriptionPlan}`);
        } else if (transaction.type === 'nar_coin') {
          console.log(`✅ NAR-coin транзакция, narAmount из metadata: ${transaction.metadata?.narAmount || 'не указано'}`);
        }
        console.log(`✅ Статус до обработки: ${transaction.status}`);
        console.log(`✅ Транзакция создана: ${transaction.createdAt.toISOString()}`);
        
        // Обновляем транзакцию как завершенную
        transaction.status = PaymentStatus.COMPLETED;
        transaction.confirmedAt = new Date();
        // Сохраняем ID транзакции Tribute в txHash для предотвращения повторной обработки
        if (tributeTransactionId) {
          transaction.txHash = String(tributeTransactionId);
        }
        transaction.metadata = {
          ...transaction.metadata,
          tributeTransactionId: tributeTransactionId,
          tributeWebhook: webhook,
        };
        await this.paymentTransactionService.updateTransaction(transaction);
        
        console.log(`🔄 Вызываю processCompletedTransaction для транзакции ${transaction.id}`);
        console.log(`🔄 Тип транзакции: ${transaction.type}, План подписки: ${transaction.subscriptionPlan}`);
        
        // Обрабатываем завершенную транзакцию (создает подписку или начисляет NAR-coin)
        await this.paymentTransactionService.processCompletedTransaction(transaction);
        
        console.log(`✅ ========== TRIBUTE ПЛАТЕЖ УСПЕШНО ОБРАБОТАН ==========`);
        console.log(`✅ transactionId=${transaction.id}, userId=${userId}, type=${type}`);
        console.log(`✅ Подписка должна быть активирована!`);
      } else {
        console.warn(`⚠️ ========== ТРАНЗАКЦИЯ НЕ НАЙДЕНА ==========`);
        console.warn(`⚠️ userId=${userId}, type=${type}`);
        console.warn(`⚠️ Найдено транзакций TRIBUTE: ${transactions.length}`);
        console.warn(`⚠️ Подходящих транзакций (недавних и необработанных): ${matchingTransactions.length}`);
        console.warn(`⚠️ Все транзакции TRIBUTE:`, transactions.map(t => ({
          id: t.id,
          status: t.status,
          type: t.type,
          method: t.method,
          createdAt: t.createdAt.toISOString(),
          subscriptionPlan: t.subscriptionPlan,
          txHash: t.txHash || 'нет',
          isRecent: t.createdAt >= twoHoursAgo,
          isPending: t.status === PaymentStatus.PENDING,
        })));
        
        // Если есть транзакции, но они все старые или уже обработаны
        const pendingTransactions = transactions.filter(t => t.status === PaymentStatus.PENDING);
        if (pendingTransactions.length > 0) {
          console.warn(`⚠️ Есть ${pendingTransactions.length} PENDING транзакций, но они либо старые (>2 часов), либо уже обработаны (имеют txHash)`);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка обработки Tribute webhook:', error);
      throw error;
    }
  }
}


