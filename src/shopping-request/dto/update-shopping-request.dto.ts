import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryTimeframe, Currency } from 'generated/prisma';
import { ProductDto } from './create-shopping-request.dto';

export class UpdateShoppingRequestDto {
  @ApiPropertyOptional({
    description: 'Product information (updates create new version)',
    type: [ProductDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDto)
  @IsOptional()
  products?: ProductDto[];

  @ApiPropertyOptional({ description: 'Delivery city' })
  @IsString()
  @IsOptional()
  deliverTo?: string;

  @ApiPropertyOptional({
    description: 'Delivery timeframe',
    enum: DeliveryTimeframe,
  })
  @IsEnum(DeliveryTimeframe)
  @IsOptional()
  deliveryTimeframe?: DeliveryTimeframe;

  @ApiPropertyOptional({
    description: 'Remove original packaging',
  })
  @IsBoolean()
  @IsOptional()
  packagingOption?: boolean;

  @ApiPropertyOptional({
    description: 'Traveler reward amount',
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
