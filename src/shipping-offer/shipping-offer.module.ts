import { Module, forwardRef } from '@nestjs/common';
import { ShippingOfferController } from './shipping-offer.controller';
import { ShippingOfferService } from './shipping-offer.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ChatModule)],
  controllers: [ShippingOfferController],
  providers: [ShippingOfferService],
  exports: [ShippingOfferService],
})
export class ShippingOfferModule {}
