import { Module, forwardRef } from '@nestjs/common';
import { PurchaseProofService } from './purchase-proof.service';
import { PurchaseProofController } from './purchase-proof.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ImageModule } from '../shared/image.module';
import { ChatModule } from '../chat/chat.module';
import { OffersModule } from '../offers/offers.module';

@Module({
  imports: [
    PrismaModule,
    ImageModule,
    forwardRef(() => ChatModule),
    forwardRef(() => OffersModule),
  ],
  controllers: [PurchaseProofController],
  providers: [PurchaseProofService],
  exports: [PurchaseProofService],
})
export class PurchaseProofModule {}
