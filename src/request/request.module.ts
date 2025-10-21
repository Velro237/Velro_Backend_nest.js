import { Module, forwardRef } from '@nestjs/common';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { CancellationService } from './cancellation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    PrismaModule,
    ChatModule,
    AuthModule,
    RedisModule,
    WalletModule,
    NotificationModule,
    forwardRef(() => PaymentModule),
  ],
  controllers: [RequestController],
  providers: [RequestService, CancellationService],
  exports: [RequestService, CancellationService],
})
export class RequestModule {}
