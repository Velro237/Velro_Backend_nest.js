import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WalletController, ConnectController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { CurrencyModule } from '../currency/currency.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    forwardRef(() => PaymentModule),
    CurrencyModule,
  ],
  controllers: [WalletController, ConnectController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
