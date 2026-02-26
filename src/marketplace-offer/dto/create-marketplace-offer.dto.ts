import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Currency, MarketplaceListingDeliveryOption } from 'generated/prisma';

export class CreateMarketplaceOfferDto {
  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  price: number;

  @ApiProperty({
    enum: Currency,
  })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    enum: MarketplaceListingDeliveryOption,
  })
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  deliveryOption: MarketplaceListingDeliveryOption;

  @ApiProperty()
  @IsString()
  @IsOptional()
  message: string;
}
