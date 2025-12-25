import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { TonService } from './ton.service';
import { WalletService } from './wallet.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { UserWallet } from './user-wallet.entity';
import { PaymentTransaction } from './payment-transaction.entity';
import { UsersModule } from '../users/users.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserWallet, PaymentTransaction]),
    UsersModule,
    forwardRef(() => SubscriptionModule),
    forwardRef(() => ReferralsModule),
    forwardRef(() => AdminModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, TonService, WalletService, PaymentTransactionService],
  exports: [PaymentService, TonService, WalletService, PaymentTransactionService],
})
export class PaymentModule {}

