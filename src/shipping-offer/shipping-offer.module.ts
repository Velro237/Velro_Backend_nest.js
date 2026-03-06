import { Module, forwardRef } from '@nestjs/common';
import { ShippingOfferController } from './shipping-offer.controller';
import { ShippingOfferService } from './shipping-offer.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ChatModule), forwardRef(() => PaymentModule)],
  controllers: [ShippingOfferController],
  providers: [ShippingOfferService],
  exports: [ShippingOfferService],
})
export class ShippingOfferModule {}
