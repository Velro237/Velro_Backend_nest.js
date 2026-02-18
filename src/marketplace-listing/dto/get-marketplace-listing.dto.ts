import { ApiProperty } from '@nestjs/swagger';
import {
  Currency,
  MarketplaceCategory,
  MarketplaceListingDeliveryOption,
  MarketplaceListingItemCondition,
  MarketplaceListingItemStatus,
} from 'generated/prisma';

export class ListingSellerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  picture: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  companyName: string;

  @ApiProperty()
  country: string;
}

export class MarketplaceListingDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  currency: Currency;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  userId: string;
  @ApiProperty()
  imageUrls: string[];
  @ApiProperty()
  productName: string;
  @ApiProperty()
  category: MarketplaceCategory;
  @ApiProperty()
  description: string | null;
  @ApiProperty()
  condition: MarketplaceListingItemCondition;
  @ApiProperty()
  price: string;
  @ApiProperty()
  quantity: number;
  @ApiProperty()
  deliveryOption: MarketplaceListingDeliveryOption;
  @ApiProperty()
  location: string;
  @ApiProperty()
  canShipInternationally: boolean | null;
  @ApiProperty()
  isNegotiable: boolean | null;
  @ApiProperty()
  status: MarketplaceListingItemStatus;
}

export class MarketplaceListingDetialDto extends MarketplaceListingDto {
  @ApiProperty()
  seller: ListingSellerDto;
}
