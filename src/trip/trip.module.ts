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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    NotificationModule,
    forwardRef(() => RequestModule),
    ChatModule,
    PaymentModule,
    WalletModule,
  ],
  controllers: [TripController],
  providers: [TripService],
})
export class TripModule {}
