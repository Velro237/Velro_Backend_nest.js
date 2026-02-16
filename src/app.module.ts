import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
} from 'nestjs-i18n';
import { TripModule } from './trip/trip.module';
import { RequestModule } from './request/request.module';
import { ChatModule } from './chat/chat.module';
import { KycModule } from './kyc/kyc.module';
import { NotificationModule } from './notification/notification.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { PaymentModule } from './payment/payment.module';
import { WalletModule } from './wallet/wallet.module';
import { CurrencyModule } from './currency/currency.module';
import { ImageModule } from './shared/image.module';
import { RidesModule } from './rides/rides.module';
import { BoatsModule } from './boats/boats.module';
import { LoggerService } from './logger/logger.service';
import { LoggerModule } from './logger/logger.module';
import { DeliveryModule } from './delivery/delivery.module';
import { ShippingRequestModule } from './shipping-request/shipping-request.module';
import { ShippingOfferModule } from './shipping-offer/shipping-offer.module';
import { ShoppingRequestModule } from './shopping-request/shopping-request.module';
import { ScraperModule } from './scraper/scraper.module';
import { OffersModule } from './offers/offers.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import * as path from 'path';
import { PurchaseProofModule } from './purchase-proof/purchase-proof.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, 'i18n'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang']),
      ], // Uses Accept-Language header
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    TripModule,
    RequestModule,
    ChatModule,
    KycModule,
    NotificationModule,
    SchedulerModule,
    PaymentModule,
    WalletModule,
    CurrencyModule,
    ImageModule,
    RidesModule,
    BoatsModule,
    LoggerModule,
    DeliveryModule,
    CloudinaryModule,
    ShippingRequestModule,
    ShippingOfferModule,
    ScraperModule,
    ShoppingRequestModule,
    OffersModule,
    PurchaseProofModule,
  ],
  controllers: [],
  providers: [LoggerService],
})
export class AppModule {}
