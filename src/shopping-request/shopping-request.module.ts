import { Module } from '@nestjs/common';
import { ShoppingRequestService } from './shopping-request.service';
import { ShoppingRequestController } from './shopping-request.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ScraperModule } from '../scraper/scraper.module';
import { OffersModule } from '../offers/offers.module';

@Module({
  imports: [PrismaModule, ScraperModule, OffersModule],
  controllers: [ShoppingRequestController],
  providers: [ShoppingRequestService],
  exports: [ShoppingRequestService],
})
export class ShoppingRequestModule {}
