import { Module, forwardRef } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { PurchaseProofModule } from 'src/purchase-proof/purchase-proof.module';
import { ShippingOfferModule } from 'src/shipping-offer/shipping-offer.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PrismaModule, ChatModule, PurchaseProofModule, ShippingOfferModule, forwardRef(() => PaymentModule)],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
