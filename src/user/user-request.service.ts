import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CountriesApiService } from 'src/currency/countries-api.service';
import { CurrencyService } from 'src/currency/currency.service';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { ImageService } from 'src/shared/services/image.service';
import { WalletService } from 'src/wallet/wallet.service';
import {
  GetUserRequestsQueryDto,
  RequestStatus,
} from './dto/get-user-requests.dto';
import { ShippingRequestService } from 'src/shipping-request/shipping-request.service';
import { ShoppingRequestService } from 'src/shopping-request/shopping-request.service';
import { ShippingRequestStatus, ShoppingRequestStatus } from 'generated/prisma';

@Injectable()
export class UserRequestService {
  // Cache for phone code to country code mapping (supports all world countries)
  private readonly logger: Logger = new Logger(UserRequestService.name);

  constructor(
    private readonly shoppingRequestService: ShoppingRequestService,
    private readonly shippingRequestService: ShippingRequestService,
  ) {}

  async getUserRequests(userId: string, query: GetUserRequestsQueryDto) {
    const { page = 1, limit = 10, status } = query;

    const [shoppingRequests, shippingRequests] = await Promise.all([
      this.shoppingRequestService.getRequests(userId, {
        page,
        limit,
        status: this.mapStatusToShoppingRequestStatus(status),
      }),
      this.shippingRequestService.getMine(userId, {
        page,
        limit,
        status: this.mapStatusToShippingRequestStatus(status),
      }),
    ]);

    return {
      shoppingRequests,
      shippingRequests,
    };
  }

  private mapStatusToShoppingRequestStatus(
    status: RequestStatus,
  ): ShoppingRequestStatus {
    switch (status) {
      case RequestStatus.IN_PROGRESS:
        return ShoppingRequestStatus.PUBLISHED;
      case RequestStatus.DELIVERED:
        return ShoppingRequestStatus.DELIVERED;
      case RequestStatus.CANCELLED:
        return ShoppingRequestStatus.CANCELLED;
    }
  }

  private mapStatusToShippingRequestStatus(
    status: RequestStatus,
  ): ShippingRequestStatus {
    switch (status) {
      case RequestStatus.IN_PROGRESS:
        return ShippingRequestStatus.PUBLISHED;
      case RequestStatus.DELIVERED:
        return ShippingRequestStatus.DELIVERED;
      case RequestStatus.CANCELLED:
        return ShippingRequestStatus.CANCELLED;
    }
  }
}
