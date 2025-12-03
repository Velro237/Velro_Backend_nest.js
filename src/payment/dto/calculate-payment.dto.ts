import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, IsEnum, IsOptional } from 'class-validator';
import { Currency } from 'generated/prisma';

export class CalculatePaymentDto {
  @ApiProperty({
    description: "Traveler's price (what they set)",
    example: 50.00,
    minimum: 0.50,
  })
  @IsNumber()
  @Min(0.50)
  travelerPrice: number;

  @ApiProperty({
    description: 'Currency of the traveler price',
    example: 'EUR',
    enum: Currency,
    default: 'EUR',
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}

export class PaymentBreakdownDto {
  @ApiProperty({
    description: "Traveler's price (what they will receive)",
    example: 50.00,
  })
  travelerPrice: number;

  @ApiProperty({
    description: 'Platform fee (charged to sender)',
    example: 4.50,
  })
  platformFee: number;

  @ApiProperty({
    description: 'Total amount sender must pay',
    example: 54.50,
  })
  senderTotal: number;

  @ApiProperty({
    description: 'Currency',
    example: 'EUR',
    enum: ['EUR', 'XAF', 'USD', 'CAD'],
  })
  currency: string;

  @ApiProperty({
    description: 'Fee breakdown for transparency',
    example: {
      feePercent: 7.0,
      feeFixed: 1.00,
      feeMin: 1.99,
    },
  })
  breakdown: {
    feePercent: number;
    feeFixed: number;
    feeMin: number;
  };
}

