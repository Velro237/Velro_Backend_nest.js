import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { MobilemoneyService } from './mobilemoney/mobilemoney.service';

@Module({
  imports: [PrismaModule, ConfigModule, forwardRef(() => WalletModule)],
  controllers: [PaymentController],
  providers: [PaymentService, StripeService, MobilemoneyService],
  exports: [PaymentService, StripeService],
})
export class PaymentModule {}
