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
  ],
  controllers: [UserController, AdminController],
  providers: [UserService],
})
export class UserModule {}
