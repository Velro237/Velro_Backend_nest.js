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
import { NotificationModule } from './notification/notification.module';
import * as path from 'path';

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
    NotificationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
