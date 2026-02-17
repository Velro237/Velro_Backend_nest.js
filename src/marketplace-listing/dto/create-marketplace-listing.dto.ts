import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  Currency,
  MarketplaceCategory,
  MarketplaceListingDeliveryOption,
  MarketplaceListingItemCondition,
  MarketplaceListingItemStatus,
} from 'generated/prisma';

export class CreateMarketplaceListingDto {
  @ApiProperty({
    description: 'Product name',
    required: true,
    example: 'Laptop',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(120)
  productName: string;

  @ApiProperty({
    description: 'Product category',
    required: true,
    enum: MarketplaceCategory,
  })
  @IsEnum(MarketplaceCategory)
  category: MarketplaceCategory;

  @ApiProperty({
    description: 'Product description',
    required: true,
    example: 'Brand new laptop',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description: string;

  @ApiProperty({
    description: 'Product condition',
    required: true,
    enum: MarketplaceListingItemCondition,
  })
  @IsEnum(MarketplaceListingItemCondition)
  condition: MarketplaceListingItemCondition;

  @ApiProperty({
    description: 'Product price',
    required: true,
    example: 1000,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  price: number;

  @ApiProperty({
    description: 'Product quantity',
    required: true,
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Product currency',
    required: true,
    enum: Currency,
  })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    description: 'Is the price negotiable?',
    required: true,
    example: true,
  })
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    const v = String(value).toLowerCase();
    return v === 'true' || v === '1';
  })
  isNegotiable: boolean;

  @ApiProperty({
    description: 'Delivery Option',
    required: true,
    enum: MarketplaceListingDeliveryOption,
  })
  @IsEnum(MarketplaceListingDeliveryOption)
  deliveryOption: MarketplaceListingDeliveryOption;

  @ApiProperty({
    description: 'Product location',
    required: true,
    example: 'New York, USA',
  })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    description: 'Can the product be shipped internationally?',
    required: true,
    example: true,
  })
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    const v = String(value).toLowerCase();
    return v === 'true' || v === '1';
  })
  canShipInternationally: boolean;

  @ApiProperty({
    description: 'Listing status',
    required: true,
    enum: MarketplaceListingItemStatus,
  })
  @IsEnum(MarketplaceListingItemStatus)
  @IsIn([
    MarketplaceListingItemStatus.PUBLISHED,
    MarketplaceListingItemStatus.DRAFT,
  ])
  status: MarketplaceListingItemStatus;
}
