import { Module, forwardRef } from '@nestjs/common';
import { TripService } from './trip.service';
import { TripController } from './trip.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { RequestModule } from '../request/request.module';
import { ChatModule } from '../chat/chat.module';
import { PaymentModule } from '../payment/payment.module';
import { WalletModule } from '../wallet/wallet.module';
import { CurrencyModule } from '../currency/currency.module';
import { ImageModule } from '../shared/image.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    NotificationModule,
    forwardRef(() => RequestModule),
    ChatModule,
    PaymentModule,
    WalletModule,
    CurrencyModule,
    ImageModule,
  ],
  controllers: [TripController],
  providers: [TripService],
  exports: [TripService],
})
export class TripModule {}
