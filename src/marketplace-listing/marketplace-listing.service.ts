import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateMarketplaceListingDto } from './dto/create-marketplace-listing.dto';
import { UpdateMarketplaceListingDto } from './dto/update-marketplace-listing.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class MarketplaceListingService {
  private readonly logger: Logger;
  private readonly MAX_LISTING_LIMIT = 1;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    this.logger = new Logger(MarketplaceListingService.name);
  }

  async create(
    images: Express.Multer.File[],
    createMarketplaceListingDto: CreateMarketplaceListingDto,
    userId: string,
  ) {
    // Check if the user has exhausted their listing limit
    if (createMarketplaceListingDto.status === 'PUBLISHED') {
      const canPublish = await this.canUserPublishListing(userId);
      if (!canPublish) {
        throw new BadRequestException(
          `Active Listing Quota Exceeded. Please archive some of your active listings and try again. Alternatively you can save your listing as a draft.`,
        );
      }
    }

    // TODO: Check user KYC verification status
    // TODO: Upload images first
    // Then create listing
    return await this.prismaService.marketplaceListing.create({
      data: {
        ...createMarketplaceListingDto,
        user: {
          connect: {
            id: userId,
          },
        },
      },
    });
  }

  findAll() {
    return `This action returns all marketplaceListing`;
  }

  findOne(id: number) {
    return `This action returns a #${id} marketplaceListing`;
  }

  update(id: number, updateMarketplaceListingDto: UpdateMarketplaceListingDto) {
    return `This action updates a #${id} marketplaceListing`;
  }

  remove(id: number) {
    return `This action removes a #${id} marketplaceListing`;
  }

  private async canUserPublishListing(userId: string): Promise<boolean> {
    const limit = await this.prismaService.marketplaceListing.count({
      where: {
        userId,
        status: 'PUBLISHED',
      },
    });
    return limit < this.MAX_LISTING_LIMIT;
  }
}
