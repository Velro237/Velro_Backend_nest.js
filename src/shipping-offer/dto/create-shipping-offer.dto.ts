import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from 'generated/prisma';

export class CreateShippingOfferDto {
  @ApiProperty({ description: 'Shipping request ID' })
  @IsString()
  requestId: string;

  @ApiProperty({ description: 'Reward amount offered by traveler' })
  @IsNumber()
  rewardAmount: number;

  @ApiPropertyOptional({
    description: 'Reward currency',
    enum: Currency,
  })
  @IsEnum(Currency)
  @IsOptional()
  rewardCurrency?: Currency;

  @ApiPropertyOptional({ description: 'Expected delivery date' })
  @IsOptional()
  @IsDateString()
  deliverBy?: string;

  @ApiPropertyOptional({ description: 'Optional message with the offer' })
  @IsOptional()
  @IsString()
  message?: string;
}
