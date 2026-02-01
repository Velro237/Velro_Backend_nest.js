import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsEnum, IsISO8601 } from 'class-validator';
import { Currency } from 'generated/prisma';

export class CreateOfferDto {
  @ApiProperty({ description: 'Shopping request id to link the offer to' })
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @ApiProperty({ description: "Traveler's reward (amount traveler will receive)", example: 189 })
  @IsNumber()
  @Min(0)
  travelerReward!: number;

  @ApiPropertyOptional({ description: 'Reward currency', enum: Currency })
  @IsEnum(Currency)
  @IsOptional()
  rewardCurrency?: Currency;

  @ApiPropertyOptional({ description: 'Any customs & shipping fees the traveler will cover', example: 25 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  additionalFees?: number;

  @ApiProperty({ description: 'Date the traveler can deliver by (ISO date)', example: '2026-01-10' })
  @IsISO8601()
  deliverBy!: string;

  @ApiPropertyOptional({ description: 'Optional message to the requester' })
  @IsString()
  @IsOptional()
  message?: string;
}

export class CancelOfferDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsString()
  @IsOptional()
  reason?: string;
}
