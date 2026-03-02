import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsUrl,
  Min,
  ValidateNested,
  IsObject,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  DeliveryTimeframe,
  RequestSource,
  Currency,
  ProductSource,
} from 'generated/prisma';

@ValidatorConstraint({ name: 'IsSourceEnumOrUrl', async: false })
class IsSourceEnumOrUrl implements ValidatorConstraintInterface {
  validate(value: any, _args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    const enums = Object.values(RequestSource).map(String);
    if (enums.includes(value)) return true;
    try {
      new URL(value);
      return true;
    } catch (_) {
      return false;
    }
  }

  defaultMessage(_args: ValidationArguments) {
    return 'source must be one of: ' + Object.values(RequestSource).join(', ') + ' or a valid URL';
  }
}

export class ProductDto {
  @ApiProperty({ description: 'Product name', example: 'iPhone 15 Pro 256GB' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Product source', enum: ProductSource })
  @IsEnum(ProductSource)
  @IsNotEmpty()
  source!: ProductSource;

  @ApiPropertyOptional({ description: 'Product URL' })
  @IsUrl()
  @IsOptional()
  url?: string;

  @ApiProperty({ description: 'Product image URLs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  imageUrls!: string[];

  @ApiProperty({ description: 'Product price', example: 999.0 })
  @IsNumber()
  @Min(0.01)
  price!: number;

  @ApiProperty({ description: 'Price currency', enum: Currency })
  @IsEnum(Currency)
  @IsNotEmpty()
  priceCurrency!: Currency;

  @ApiPropertyOptional({ description: 'Product weight in kg' })
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiProperty({ description: 'Quantity', example: 1, default: 1 })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Product variants (size, color, etc.)' })
  @IsObject()
  @IsOptional()
  variants?: Record<string, any>;

  @ApiProperty({ description: 'In stock status', default: true })
  @IsBoolean()
  inStock!: boolean;

  @ApiPropertyOptional({ description: 'Availability text' })
  @IsString()
  @IsOptional()
  availabilityText?: string;
}

export class CreateShoppingRequestDto {
  @ApiProperty({
    description: 'Request source (enum or a URL)',
    example: RequestSource.URL,
  })
  @IsString()
  @IsNotEmpty()
  @Validate(IsSourceEnumOrUrl)
  source!: string;

  @ApiProperty({
    description: 'Product information',
    type: [ProductDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDto)
  products!: ProductDto[];

  @ApiProperty({
    description: 'Delivery city',
    example: 'Douala, Cameroon',
  })
  @IsString()
  @IsNotEmpty()
  deliverTo!: string;

  @ApiProperty({
    description: 'Delivery timeframe',
    enum: DeliveryTimeframe,
    example: DeliveryTimeframe.ONE_MONTH,
  })
  @IsEnum(DeliveryTimeframe)
  @IsNotEmpty()
  deliveryTimeframe!: DeliveryTimeframe;

  @ApiPropertyOptional({
    description: 'Remove original packaging',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  packagingOption?: boolean;

  @ApiPropertyOptional({
    description:
      'Traveler reward amount (if not provided, 15% will be suggested)',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  travelerReward?: number;

  @ApiPropertyOptional({
    description: 'Reward currency',
    enum: Currency,
  })
  @IsEnum(Currency)
  @IsOptional()
  rewardCurrency?: Currency;

  @ApiPropertyOptional({
    description: 'Additional notes for the traveler',
  })
  @IsString()
  @IsOptional()
  additionalNotes?: string;
}

// Flattened DTO for manual creation (multipart/form-data); images come from file upload
export class CreateManualShoppingRequestDto {
  @ApiProperty({ description: 'Delivery city', example: 'Douala, Cameroon' })
  @IsString()
  @IsNotEmpty()
  deliverTo!: string;

  @ApiProperty({
    description: 'Delivery timeframe',
    enum: DeliveryTimeframe,
    example: DeliveryTimeframe.ONE_MONTH,
  })
  @IsEnum(DeliveryTimeframe)
  @IsNotEmpty()
  deliveryTimeframe!: DeliveryTimeframe;

  @ApiPropertyOptional({
    description: 'Remove original packaging',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    const v = String(value).toLowerCase();
    return v === 'true' || v === '1';
  })
  packagingOption?: boolean;

  @ApiPropertyOptional({
    description:
      'Traveler reward amount (if not provided, 15% will be suggested)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  travelerReward?: number;

  @ApiPropertyOptional({ description: 'Reward currency', enum: Currency })
  @IsEnum(Currency)
  @IsOptional()
  rewardCurrency?: Currency;

  @ApiPropertyOptional({ description: 'Additional notes for the traveler' })
  @IsString()
  @IsOptional()
  additionalNotes?: string;

  @ApiProperty({ description: 'Product name', example: 'iPhone 15 Pro 256GB' })
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsString()
  @IsOptional()
  productDescription?: string;

  @ApiPropertyOptional({ description: 'Product source', enum: ProductSource })
  @IsEnum(ProductSource)
  @IsNotEmpty()
  productSource!: ProductSource;

  @ApiProperty({ description: 'Product price', example: 999.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  productPrice!: number;

  @ApiProperty({ description: 'Price currency', enum: Currency })
  @IsEnum(Currency)
  @IsNotEmpty()
  productPriceCurrency!: Currency;

  @ApiPropertyOptional({ description: 'Product weight in kg' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  productWeight?: number;

  @ApiProperty({ description: 'Quantity', example: 1, default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  productQuantity!: number;

  @ApiPropertyOptional({
    description: 'Product variants as JSON string (size, color, etc.)',
  })
  @IsString()
  @IsOptional()
  productVariants?: string;

  @ApiProperty({ description: 'In stock status', default: true })
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'boolean') return value;
    const v = String(value).toLowerCase();
    return v === 'true' || v === '1';
  })
  productInStock!: boolean;

  @ApiPropertyOptional({ description: 'Availability text' })
  @IsString()
  @IsOptional()
  productAvailabilityText?: string;
}

// DTO for URL-based request creation
export class CreateShoppingRequestFromUrlDto {
  @ApiProperty({
    description: 'Product URL to scrape',
    example: 'https://www.amazon.com/dp/B08N5WRWNW',
  })
  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({
    description: 'Delivery city',
    example: 'Douala, Cameroon',
  })
  @IsString()
  @IsNotEmpty()
  deliverTo!: string;

  @ApiProperty({
    description: 'Delivery timeframe',
    enum: DeliveryTimeframe,
  })
  @IsEnum(DeliveryTimeframe)
  @IsNotEmpty()
  deliveryTimeframe!: DeliveryTimeframe;

  @ApiPropertyOptional({
    description: 'Remove original packaging',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  packagingOption?: boolean;

  @ApiPropertyOptional({
    description: 'Quantity',
    default: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    description:
      'Traveler reward amount (if not provided, 15% will be suggested)',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  travelerReward?: number;

  @ApiPropertyOptional({
    description: 'Reward currency',
    enum: Currency,
  })
  @IsEnum(Currency)
  @IsOptional()
  rewardCurrency?: Currency;

  @ApiPropertyOptional({
    description: 'Additional notes for the traveler',
  })
  @IsString()
  @IsOptional()
  additionalNotes?: string;
}
