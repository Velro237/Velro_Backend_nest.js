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
import { ListingErrorMessage } from './misc/listing-error-message';
import { TimeMs } from 'src/shared/utils';
import {
  GetMarketplaceListingsQueryDto,
  GetUserListingsQueryDto,
  ListingSortMode,
} from './dto/get-marketplace-listing.dto';
import { MarketplaceListingItemStatus, Prisma } from 'generated/prisma';

type CursorData = {
  id: string;
  createdAt: Date;
  price: number;
};

@Injectable()
export class MarketplaceListingService {
  private readonly logger: Logger;
  private readonly MAX_LISTING_LIMIT = 20;
  private readonly LISTING_DURATION = TimeMs.days(30);

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
    let expiryDate: Date | undefined = undefined;

    // Check if the user has exhausted their listing limit
    if (createMarketplaceListingDto.status === 'PUBLISHED') {
      const canPublish = await this.canUserPublishListing(userId);
      expiryDate = this.calcExpiryDate();

      if (!canPublish) {
        throw new TooManyRequestsException(
          ListingErrorMessage.PUBLISH_QUOTA_EXCEEDED,
        );
      }
    }

    // TODO: Check user KYC verification status

    // 1. Create listing
    const data = await this.prismaService.marketplaceListing.create({
      data: {
        ...createMarketplaceListingDto,
        expiresAt: expiryDate,
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

  async findUserListings(userId: string, query: GetUserListingsQueryDto) {
    return this.getListings({ query, userId, status: query.status });
  }

  async findAll(query: GetMarketplaceListingsQueryDto) {
    return this.getListings({ query, status: 'PUBLISHED' });
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

    if (!listing)
      throw new NotFoundException(ListingErrorMessage.LISTING_NOT_FOUND);

    const { user: seller, ...rest } = listing;
    return {
      ...rest,
      seller,
    };
  }

  async update(
    id: string,
    updateMarketplaceListingDto: UpdateMarketplaceListingDto,
    userId: string,
  ) {
    const listing = await this.getListingByIdAndUserId(id, userId);

    if (listing.status === 'ARCHIVED' || listing.status === 'PAID_ESCROW') {
      throw new BadRequestException(
        ListingErrorMessage.LISTING_CANNOT_BE_MODIFIED,
      );
    }

    if (listing.status === 'PUBLISHED') {
      // Discard price, quantity, and currency
      updateMarketplaceListingDto.price = undefined;
      updateMarketplaceListingDto.quantity = undefined;
      updateMarketplaceListingDto.currency = undefined;
    }

    return await this.prismaService.marketplaceListing.update({
      where: { id },
      data: updateMarketplaceListingDto,
    });
  }

  async publish(id: string, userId: string) {
    const listing = await this.getListingByIdAndUserId(id, userId);

    if (listing.status !== 'DRAFT') {
      throw new BadRequestException(
        ListingErrorMessage.LISTING_ALREADY_PUBLISHED,
      );
    }

    const expiresAt = this.calcExpiryDate();

    return await this.prismaService.marketplaceListing.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        saleStatus: 'PENDING',
        expiresAt,
      },
    });
  }

  async markSold(id: string, userId: string) {
    const listing = await this.getListingByIdAndUserId(id, userId);

    if (
      listing.status !== 'PAID_ESCROW' ||
      listing.saleStatus !== 'IN_ESCROW'
    ) {
      throw new BadRequestException(
        ListingErrorMessage.LISTING_NOT_PAID_ESCROW,
      );
    }

    return await this.prismaService.marketplaceListing.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        saleStatus: 'SOLD',
      },
    });
  }

  remove(id: number) {
    return `This action removes a #${id} marketplaceListing`;
  }

  private async getListings({
    query,
    userId,
    status,
  }: {
    query: GetMarketplaceListingsQueryDto;
    userId?: string;
    status?: MarketplaceListingItemStatus;
  }) {
    const {
      limit = 10,
      sortMode = ListingSortMode.RECENT,
      location,
      category,
      condition,
      minPrice,
      maxPrice,
      cursor,
    } = query;

    const cursorData = this.decodeCursor<CursorData>(cursor);

    const cursorFilters = this.buildCursorFilters(sortMode, cursorData);

    const orderBy = this.buildOrderBy(sortMode);

    const data = await this.prismaService.marketplaceListing.findMany({
      take: limit + 1,
      where: {
        ...cursorFilters,
        userId,
        price: {
          gte: minPrice,
          lte: maxPrice,
        },
        status: status,
        location: {
          mode: 'insensitive',
          contains: location,
        },
        category,
        condition,
      },
      orderBy,
    });

    const hasNextPage = data.length > limit;
    if (hasNextPage) data.pop();

    const lastItem = data.at(data.length - 1);

    const nextCursor: string | null =
      hasNextPage && !!lastItem
        ? this.encodeCursor({
            id: lastItem.id,
            createdAt: lastItem.createdAt,
            price: lastItem.price,
          })
        : null;

    return {
      content: data,
      page: {
        hasNextPage,
        nextCursor,
      },
    };
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

  private async getListingByIdAndUserId(id: string, userId: string) {
    const listing = await this.prismaService.marketplaceListing.findUnique({
      where: { id, userId },
    });

    if (!listing)
      throw new NotFoundException(ListingErrorMessage.LISTING_NOT_FOUND);

    const canPublish = await this.canUserPublishListing(userId);
    if (!canPublish) {
      throw new TooManyRequestsException(
        ListingErrorMessage.PUBLISH_QUOTA_EXCEEDED,
      );
    }

    return listing;
  }

  private calcExpiryDate(): Date {
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return new Date(today + this.LISTING_DURATION);
  }

  private encodeCursor(data: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeCursor<T>(cursor: string | undefined): T | null {
    if (!cursor || cursor.length < 1) return null;

    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as T;
    } catch (err) {
      this.logger.error('Failed to decode cursor.', err);

      return null;
    }
  }

  private buildOrderBy(
    sortMode: ListingSortMode,
  ): Prisma.MarketplaceListingOrderByWithRelationInput[] {
    if (sortMode === ListingSortMode.PRICE_ASC)
      return [
        {
          price: 'asc',
        },
        {
          id: 'asc',
        },
      ];

    if (sortMode === ListingSortMode.PRICE_DESC)
      return [
        {
          price: 'desc',
        },
        {
          id: 'desc',
        },
      ];

    return [
      {
        createdAt: 'desc',
      },
      {
        id: 'desc',
      },
    ];
  }

  private buildCursorFilters(
    sortMode: ListingSortMode,
    cursorData: CursorData | null,
  ): Prisma.MarketplaceListingWhereInput {
    if (!cursorData) return {};

    const { id, price, createdAt } = cursorData;

    const d = new Date(createdAt);

    if (sortMode === ListingSortMode.PRICE_ASC) {
      return {
        OR: [
          {
            price: {
              gt: price,
            },
          },
          {
            price,
            id: {
              gt: id,
            },
          },
        ],
      };
    }

    if (sortMode === ListingSortMode.PRICE_DESC) {
      return {
        OR: [
          {
            price: {
              lt: price,
            },
          },
          {
            price,
            id: {
              lt: id,
            },
          },
        ],
      };
    }

    return {
      OR: [
        {
          createdAt: {
            lt: d,
          },
        },
        {
          createdAt: d,
          id: {
            lt: id,
          },
        },
      ],
    };
  }
}
