import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { PaymentService, TonPaymentRequest } from './payment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

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
}

