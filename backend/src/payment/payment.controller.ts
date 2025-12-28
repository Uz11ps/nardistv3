import { Controller, Post, Body, UseGuards, Get, Param, BadRequestException, Headers, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PaymentService, PaymentRequest } from './payment.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}


  @Post('webhook')
  async handleWebhook(
    @Body() update: any,
    @Headers('trbt-signature') signature: string,
    @Req() req: Request,
  ) {
    // Проверяем подпись для Tribute webhook (если есть заголовок trbt-signature)
    if (signature) {
      // ВАЖНО: Tribute вычисляет подпись от raw JSON body
      // В NestJS body уже распарсен, поэтому используем JSON.stringify
      // Для production рекомендуется использовать raw body middleware для точной проверки
      const rawBody = JSON.stringify(update);
      const isValid = this.paymentService.verifyTributeWebhookSignature(rawBody, signature);
      
      if (!isValid) {
        console.error('❌ Tribute webhook: неверная подпись', {
          signature: signature?.substring(0, 16) + '...',
          bodyLength: rawBody.length,
          hasApiKey: this.paymentService.hasTributeApiKey(),
        });
        throw new UnauthorizedException('Неверная подпись Tribute webhook');
      }
      
      console.log('✅ Подпись Tribute webhook проверена успешно');
    } else {
      // Если нет подписи, но это может быть webhook от Tribute - предупреждаем
      if (update.event === 'payment.completed' || update.type === 'payment.completed') {
        console.warn('⚠️ Получен Tribute webhook без подписи. Проверьте настройку TRIBUTE_API_KEY и webhook URL в панели Tribute.');
      }
    }

    return this.paymentService.handlePaymentWebhook(update);
  }

  /**
   * Универсальный endpoint для подтверждения транзакции (работает для всех типов: подписка, NAR-coin, скины)
   */
  @Post('transaction/:transactionId/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmTransaction(
    @CurrentUser() user: any,
    @Param('transactionId') transactionId: string,
    @Body() body: { txHash: string },
  ) {
    const transaction = await this.paymentTransactionService.getTransaction(transactionId);
    
    // Проверяем, что транзакция принадлежит пользователю
    if (transaction.userId !== user.id) {
      throw new BadRequestException('Транзакция не принадлежит пользователю');
    }

    // Обновляем хеш транзакции
    const updatedTransaction = await this.paymentTransactionService.updateTransactionHash(transactionId, body.txHash);
    
    // Проверяем статус транзакции в блокчейне
    await this.paymentTransactionService.checkTransactionStatus(transactionId);

    return {
      message: 'Платеж подтвержден, проверяется в блокчейне',
      transactionId: updatedTransaction.id,
      status: updatedTransaction.status,
    };
  }

  /**
   * Универсальный endpoint для проверки статуса транзакции (работает для всех типов)
   */
  @Get('transaction/:transactionId/status')
  @UseGuards(JwtAuthGuard)
  async getTransactionStatus(
    @CurrentUser() user: any,
    @Param('transactionId') transactionId: string,
  ) {
    const transaction = await this.paymentTransactionService.getTransaction(transactionId);

    // Проверяем, что транзакция принадлежит пользователю
    if (transaction.userId !== user.id) {
      throw new BadRequestException('Транзакция не принадлежит пользователю');
    }

    // Проверяем статус в блокчейне только если есть хеш транзакции и статус не завершен
    if (transaction.status !== 'completed' && transaction.status !== 'failed' && transaction.txHash) {
      await this.paymentTransactionService.checkTransactionStatus(transactionId);
      // Получаем обновленную транзакцию
      return await this.paymentTransactionService.getTransaction(transactionId);
    }

    return transaction;
  }
}

