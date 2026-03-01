import { Module } from '@nestjs/common';
import { ShoppingRequestService } from './shopping-request.service';
import { ShoppingRequestController } from './shopping-request.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ScraperModule } from '../scraper/scraper.module';
import { OffersModule } from '../offers/offers.module';
import { ImageModule } from '../shared/image.module';

@Module({
  imports: [PrismaModule, ScraperModule, OffersModule, ImageModule],
  controllers: [ShoppingRequestController],
  providers: [ShoppingRequestService],
  exports: [ShoppingRequestService],
})
export class ShoppingRequestModule {}
