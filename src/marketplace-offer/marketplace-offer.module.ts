import { Module } from '@nestjs/common';
import { MarketplaceOfferService } from './marketplace-offer.service';
import { MarketplaceOfferController } from './marketplace-offer.controller';
import { MarketplaceListingModule } from 'src/marketplace-listing/marketplace-listing.module';
import { ChatModule } from 'src/chat/chat.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [MarketplaceListingModule, ChatModule, PrismaModule],
  controllers: [MarketplaceOfferController],
  providers: [MarketplaceOfferService],
})
export class MarketplaceOfferModule {}
