import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperService } from '../scraper/scraper.service';
import {
  CreateShoppingRequestDto,
  CreateShoppingRequestFromUrlDto,
} from './dto/create-shopping-request.dto';
import { UpdateShoppingRequestDto } from './dto/update-shopping-request.dto';
import { GetShoppingRequestsQueryDto } from './dto/get-shopping-requests-query.dto';
import {
  ShoppingRequestStatus,
  DeliveryTimeframe,
  Currency,
  RequestSource,
  ProductSource,
} from 'generated/prisma';
import { Decimal } from 'generated/prisma/runtime/library';

@Injectable()
export class ShoppingRequestService {
  private readonly logger = new Logger(ShoppingRequestService.name);
  private readonly PLATFORM_FEE_PERCENTAGE = 15; // 15% platform fee
  private readonly SUGGESTED_REWARD_PERCENTAGE = 15; // 15% suggested reward

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly scraperService: ScraperService,
  ) {}

  /**
   * Create shopping request from URL (scrapes product details)
   */
  async createFromUrl(
    userId: string,
    dto: CreateShoppingRequestFromUrlDto,
    lang: string,
  ) {
    // Scrape product details
    const scrapedProduct = await this.scraperService.scrapeProduct(dto.url);

    // Map scraped product to ProductDto format
    const products = [
      {
        name: scrapedProduct.name,
        description: scrapedProduct.description,
        source: this.mapSourceToProductSource(scrapedProduct.source),
        url: dto.url,
        imageUrls: scrapedProduct.imageUrls,
        price: scrapedProduct.price,
        priceCurrency: this.mapCurrency(scrapedProduct.currency),
        weight: scrapedProduct.weight,
        quantity: dto.quantity || 1,
        variants: scrapedProduct.variants,
        inStock: scrapedProduct.inStock,
        availabilityText: scrapedProduct.availabilityText,
      },
    ];

    // Create request using the main create method
    return this.create(
      userId,
      {
        source: RequestSource.URL,
        products,
        deliverTo: dto.deliverTo,
        deliveryTimeframe: dto.deliveryTimeframe,
        packagingOption: dto.packagingOption || false,
        travelerReward: dto.travelerReward,
        rewardCurrency: dto.rewardCurrency,
        additionalNotes: dto.additionalNotes,
      },
      lang,
    );
  }

  /**
   * Create shopping request (manual or webview)
   */
  async create(userId: string, dto: CreateShoppingRequestDto, lang: string) {
    // Calculate totals
    const productPrice = dto.products.reduce(
      (sum, p) => sum + p.price * p.quantity,
      0,
    );
    const productCurrency = dto.products[0]?.priceCurrency || Currency.EUR;

    // Calculate reward (use provided or suggest 15%)
    const suggestedReward =
      productPrice * (this.SUGGESTED_REWARD_PERCENTAGE / 100);
    const travelerReward = dto.travelerReward ?? suggestedReward;
    const rewardCurrency = dto.rewardCurrency || productCurrency;

    // Calculate platform fee (15% of item value)
    const platformFee = productPrice * (this.PLATFORM_FEE_PERCENTAGE / 100);

    // Calculate total cost
    const totalCost = productPrice + travelerReward + platformFee;

    // Set expiration (60 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    // Determine DB source value: if dto.source is a URL string, store RequestSource.URL
    let dbSource: RequestSource;
    try {
      new URL(dto.source);
      dbSource = RequestSource.URL;
    } catch {
      dbSource = (dto.source as unknown as RequestSource) || RequestSource.MANUAL;
    }

    // Create shopping request with products
    const shoppingRequest = await this.prisma.shoppingRequest.create({
      data: {
        user_id: userId,
        source: dbSource,
        deliver_to: dto.deliverTo,
        delivery_timeframe: dto.deliveryTimeframe,
        packaging_option: dto.packagingOption || false,
        product_price: new Decimal(productPrice),
        product_currency: productCurrency,
        traveler_reward: new Decimal(travelerReward),
        reward_currency: rewardCurrency,
        platform_fee: new Decimal(platformFee),
        additional_fees: new Decimal(0),
        total_cost: new Decimal(totalCost),
        suggested_reward_percentage: new Decimal(
          this.SUGGESTED_REWARD_PERCENTAGE,
        ),
        additional_notes: dto.additionalNotes,
        status: ShoppingRequestStatus.PUBLISHED,
        expires_at: expiresAt,
        version: 1,
        current_version: 1,
        products: {
          create: dto.products.map((p) => ({
            name: p.name,
            description: p.description,
            source: p.source,
            url: p.url,
            image_urls: p.imageUrls,
            price: new Decimal(p.price),
            price_currency: p.priceCurrency,
            weight: p.weight ? new Decimal(p.weight) : null,
            quantity: p.quantity,
            variants: p.variants ? (p.variants as any) : undefined,
            in_stock: p.inStock,
            availability_text: p.availabilityText,
          })),
        },
      },
      include: {
        products: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return shoppingRequest;
  }

  /**
   * Update shopping request (creates new version if offers exist)
   */
  async update(
    userId: string,
    requestId: string,
    dto: UpdateShoppingRequestDto,
    lang: string,
  ) {
    const request = await this.prisma.shoppingRequest.findUnique({
      where: { id: requestId },
      include: {
        offers: {
          where: {
            status: 'PENDING',
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'SHOPPING_REQUEST_NOT_FOUND',
        message: await this.i18n.translate(
          'translation.errors.shopping_request.not_found',
          { lang },
        ),
      });
    }

    if (request.user_id !== userId) {
      throw new ForbiddenException({
        code: 'NOT_REQUEST_OWNER',
        message: await this.i18n.translate(
          'translation.errors.shopping_request.not_owner',
          { lang },
        ),
      });
    }

    if (request.status !== ShoppingRequestStatus.PUBLISHED) {
      throw new BadRequestException({
        code: 'CANNOT_EDIT_ACCEPTED_REQUEST',
        message: await this.i18n.translate(
          'translation.errors.shopping_request.cannot_edit_accepted',
          { lang },
        ),
      });
    }

    // If offers exist, create new version
    const newVersion =
      request.offers.length > 0
        ? request.current_version + 1
        : request.current_version;

    // Recalculate totals if products or reward changed
    // ... (implementation continues)

    return request; // Placeholder
  }

  /**
   * Get shopping requests with pagination
   */
  async getRequests(userId: string, query: GetShoppingRequestsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.type === 'my_requests') {
      where.user_id = userId;
    } else if (query.type === 'available') {
      // Requests where user is not the owner and status is PUBLISHED
      where.user_id = { not: userId };
      where.status = ShoppingRequestStatus.PUBLISHED;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.shoppingRequest.findMany({
        where,
        include: {
          products: true,
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              offers: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.shoppingRequest.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Helper methods
  private mapSourceToProductSource(source: string): ProductSource {
    const sourceMap: Record<string, ProductSource> = {
      amazon: ProductSource.AMAZON,
      shein: ProductSource.SHEIN,
      hm: ProductSource.HM,
      nike: ProductSource.NIKE,
      zara: ProductSource.ZARA,
      apple: ProductSource.APPLE,
      ebay: ProductSource.EBAY,
    };
    return sourceMap[source.toLowerCase()] || ProductSource.OTHER;
  }

  private mapCurrency(currency: string): Currency {
    const currencyMap: Record<string, Currency> = {
      eur: Currency.EUR,
      usd: Currency.USD,
      cad: Currency.CAD,
      xaf: Currency.XAF,
    };
    return currencyMap[currency.toUpperCase()] || Currency.EUR;
  }
}
