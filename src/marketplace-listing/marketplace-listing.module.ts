import { Module } from '@nestjs/common';
import { MarketplaceListingService } from './marketplace-listing.service';
import { MarketplaceListingController } from './marketplace-listing.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [MarketplaceListingController],
  providers: [MarketplaceListingService],
})
export class MarketplaceListingModule {}
