import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ImageModule } from '../shared/image.module';
import { NotificationModule } from '../notification/notification.module';
import { CurrencyModule } from '../currency/currency.module';
import { WalletModule } from '../wallet/wallet.module';
import { RequestModule } from '../request/request.module';
import { RedisModule } from '../redis/redis.module';
import { ChatModule } from '../chat/chat.module';
import { TripModule } from '../trip/trip.module';
import { PaymentModule } from '../payment/payment.module';
import { UserRequestService } from './user-request.service';
import { UserRequestController } from './user-request.controller';
import { ShoppingRequestModule } from 'src/shopping-request/shopping-request.module';
import { ShippingRequestModule } from 'src/shipping-request/shipping-request.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ImageModule,
    NotificationModule,
    CurrencyModule,
    WalletModule,
    RequestModule,
    RedisModule,
    ChatModule,
    TripModule,
    PaymentModule,
    ShoppingRequestModule,
    ShippingRequestModule,
  ],
  controllers: [UserController, AdminController, UserRequestController],
  providers: [UserService, UserRequestService],
})
export class UserModule {}
