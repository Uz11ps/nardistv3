import { Controller, Post, Body, UseGuards, Get, Param, BadRequestException } from '@nestjs/common';
import { PaymentService, TonPaymentRequest } from './payment.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}

  @Post('ton/create')
  @UseGuards(JwtAuthGuard)
  async createTonPayment(
    @CurrentUser() user: any,
    @Body() body: { amount: number; description: string; type: 'subscription' | 'nar_coin' | 'skin' },
  ) {
    const request: TonPaymentRequest = {
      userId: user.id,
      amount: body.amount,
      description: body.description || `Оплата: ${body.type}`,
      type: body.type,
    };

    return this.paymentService.createTonPayment(request);
  }

  @Get('ton/status/:paymentId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(@Param('paymentId') paymentId: string) {
    return this.paymentService.checkPaymentStatus(paymentId);
  }

  @Post('webhook')
  async handleWebhook(@Body() update: any) {
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

