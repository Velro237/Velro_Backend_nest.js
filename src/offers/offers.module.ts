import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { PurchaseProofModule } from 'src/purchase-proof/purchase-proof.module';

@Module({
  imports: [PrismaModule, ChatModule, PurchaseProofModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
