import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateMarketplaceListingDto } from './dto/create-marketplace-listing.dto';
import { UpdateMarketplaceListingDto } from './dto/update-marketplace-listing.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TooManyRequestsException } from 'src/shared/exceptions/too-many-requests.exception';
import { ImageService } from 'src/shared/services/image.service';
import { ErrorMessage } from './misc/error-message';

@Injectable()
export class MarketplaceListingService {
  private readonly logger: Logger;
  private readonly MAX_LISTING_LIMIT = 20;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly imageService: ImageService,
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
        throw new TooManyRequestsException(ErrorMessage.PUBLISH_QUOTA_EXCEEDED);
      }
    }

    // TODO: Check user KYC verification status

    // 1. Create listing
    const data = await this.prismaService.marketplaceListing.create({
      data: {
        ...createMarketplaceListingDto,
        user: {
          connect: {
            id: userId,
          },
        },
      },
    });

    this.logger.log(`Created listing ${data.id}`);

    // 2. Upload images
    let imageUrls: string[] = [];

    if (images && data && images.length > 0) {
      this.logger.log(`Uploading images for listing ${data.id}`);

      const uploadedImages = await this.imageService.uploadMultipleFiles(
        images,
        {
          folder: 'marketplace/listings',
          object_id: data.id,
        },
      );

      // 3. If images were uploaded successfully, update listing
      if (uploadedImages && uploadedImages.images.length > 0) {
        this.logger.log(`Updated listing ${data.id} with images`);
        imageUrls = uploadedImages.images.map((image) => image.secure_url);
        this.logger.log('Image upload result', imageUrls);

        await this.prismaService.marketplaceListing.update({
          where: {
            id: data.id,
          },
          data: {
            imageUrls: {
              set: imageUrls,
            },
          },
        });
      }
    }

    return { ...data, imageUrls };
  }

  findAll() {
    return `This action returns all marketplaceListing`;
  }

  async findOne(id: string) {
    const listing = await this.prismaService.marketplaceListing.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            username: true,
            picture: true,
            companyName: true,
            country: true,
          },
        },
      },
    });

    if (!listing) throw new NotFoundException(ErrorMessage.LISTING_NOT_FOUND);

    const { user: seller, ...rest } = listing;
    return {
      ...rest,
      seller,
    };
  }

  update(id: number, updateMarketplaceListingDto: UpdateMarketplaceListingDto) {
    return `This action updates a #${id} marketplaceListing`;
  }

  async publish(id: string, userId: string) {
    const listing = await this.prismaService.marketplaceListing.findUnique({
      where: { id, userId },
    });

    if (!listing) throw new NotFoundException(ErrorMessage.LISTING_NOT_FOUND);

    const canPublish = await this.canUserPublishListing(userId);
    if (!canPublish) {
      throw new TooManyRequestsException(ErrorMessage.PUBLISH_QUOTA_EXCEEDED);
    }

    if (listing.status === 'PUBLISHED') {
      throw new BadRequestException(ErrorMessage.LISTING_ALREADY_PUBLISHED);
    }

    return await this.prismaService.marketplaceListing.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
      },
    });
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
