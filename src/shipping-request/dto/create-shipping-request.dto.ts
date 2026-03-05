import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  ShippingDeliveryTimeframe,
  ShippingWeight,
  ShippingCategory,
  Currency,
} from 'generated/prisma';

export class CreateShippingRequestDto {
  @ApiProperty({
    description: 'Category of the package',
    enum: ShippingCategory,
  })
  @IsEnum(ShippingCategory)
  category!: ShippingCategory;

  @ApiProperty({ description: 'From location (origin)' })
  @IsString()
  @IsNotEmpty()
  from!: string;

  @ApiProperty({ description: 'To location (destination)' })
  @IsString()
  @IsNotEmpty()
  to!: string;

  @ApiPropertyOptional({ description: 'Package description (short)' })
  @IsString()
  @IsNotEmpty()
  packageDescription!: string;

  @ApiPropertyOptional({ description: 'Details description (optional)' })
  @IsString()
  @IsOptional()
  detailsDescription?: string;

  @ApiProperty({
    description: 'Delivery timeframe',
    enum: ShippingDeliveryTimeframe,
  })
  @IsEnum(ShippingDeliveryTimeframe)
  deliveryTimeframe!: ShippingDeliveryTimeframe;

  @ApiProperty({ description: 'Weight category', enum: ShippingWeight })
  @IsEnum(ShippingWeight)
  weight!: ShippingWeight;

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
  packaging?: boolean;

  @ApiProperty({ description: "Traveler's reward amount", example: 10.0 })
  @Type(() => Number)
  @IsNumber()
  travelerReward!: number;

  @ApiPropertyOptional({ description: 'Reward currency', enum: Currency })
  @IsEnum(Currency)
  @IsOptional()
  rewardCurrency: Currency;
}
