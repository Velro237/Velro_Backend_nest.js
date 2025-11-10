import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { MobilemoneyService } from './mobilemoney/mobilemoney.service';
import { RequestModule } from '../request/request.module';
import { CurrencyModule } from '../currency/currency.module';
import { NotificationModule } from '../notification/notification.module';
import { BankTransferService } from './bank-transfer/bank-transfer.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    forwardRef(() => WalletModule),
    forwardRef(() => RequestModule),
    CurrencyModule,
    NotificationModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    StripeService,
    MobilemoneyService,
    BankTransferService,
  ],
  exports: [PaymentService, StripeService, BankTransferService],
})
export class PaymentModule {}
