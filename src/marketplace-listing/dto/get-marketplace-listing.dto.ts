import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import {
  Currency,
  MarketplaceCategory,
  MarketplaceListingDeliveryOption,
  MarketplaceListingItemCondition,
  MarketplaceListingItemStatus,
} from 'generated/prisma';
import { CursorPaginationQueryDto } from './cursor-p[agination.dto';

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

export enum ListingSortMode {
  RECENT = 'RECENT',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
}

export class GetMarketplaceListingsQueryDto extends CursorPaginationQueryDto {
  @IsString()
  @IsOptional()
  @ApiProperty()
  location: string;

  @IsEnum(MarketplaceCategory)
  @IsOptional()
  @ApiProperty({
    enum: MarketplaceCategory,
  })
  category: MarketplaceCategory;

  @IsEnum(MarketplaceListingItemCondition)
  @IsOptional()
  @ApiProperty({
    enum: MarketplaceListingItemCondition,
  })
  condition: MarketplaceListingItemCondition;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @ApiProperty({ type: Number })
  minPrice: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @ApiProperty({ type: Number })
  maxPrice: number;

  @IsEnum(ListingSortMode)
  @IsOptional()
  @ApiProperty({
    enum: ListingSortMode,
  })
  sortMode: ListingSortMode;
}

export class GetUserListingsQueryDto extends GetMarketplaceListingsQueryDto {
  @ApiProperty({
    enum: MarketplaceListingItemStatus,
  })
  @IsEnum(MarketplaceListingItemStatus)
  @IsOptional()
  status: MarketplaceListingItemStatus;
}
