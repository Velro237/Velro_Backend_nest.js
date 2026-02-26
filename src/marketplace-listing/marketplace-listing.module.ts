import { Module } from '@nestjs/common';
import { MarketplaceListingService } from './marketplace-listing.service';
import { MarketplaceListingController } from './marketplace-listing.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ImageModule } from 'src/shared/image.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [PrismaModule, ImageModule, RedisModule],
  controllers: [MarketplaceListingController],
  providers: [MarketplaceListingService],
  exports: [MarketplaceListingService],
})
export class MarketplaceListingModule {}
