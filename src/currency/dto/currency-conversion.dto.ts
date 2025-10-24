import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CurrencyConversionRequestDto {
  @ApiProperty({
    description: 'Amount to convert',
    example: 100,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Source currency code',
    example: 'XAF',
    enum: ['USD', 'EUR', 'CAD', 'XAF'],
  })
  @IsString()
  fromCurrency: string;

  @ApiProperty({
    description: 'Target currency code',
    example: 'EUR',
    enum: ['USD', 'EUR', 'CAD', 'XAF'],
  })
  @IsString()
  toCurrency: string;
}

export class CurrencyConversionResponseDto {
  @ApiProperty({
    description: 'Source currency',
    example: 'XAF',
  })
  fromCurrency: string;

  @ApiProperty({
    description: 'Target currency',
    example: 'EUR',
  })
  toCurrency: string;

  @ApiProperty({
    description: 'Original amount',
    example: 68000,
  })
  amount: number;

  @ApiProperty({
    description: 'Converted amount',
    example: 100,
  })
  convertedAmount: number;

  @ApiProperty({
    description: 'Exchange rate used',
    example: 680,
  })
  exchangeRate: number;

  @ApiProperty({
    description: 'Conversion timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  timestamp: Date;
}

export class TripPriceDisplayRequestDto {
  @ApiProperty({
    description: 'Trip ID to get the base currency from',
    example: 'trip-uuid',
  })
  @IsString()
  tripId: string;

  @ApiProperty({
    description: 'Price to convert for display',
    example: 100,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  price: number;
}

export class TripPriceDisplayResponseDto {
  @ApiProperty({
    description: 'Display price in user currency',
    example: 68000,
  })
  displayPrice: number;

  @ApiProperty({
    description: 'Display currency',
    example: 'XAF',
  })
  displayCurrency: string;

  @ApiProperty({
    description: 'Exchange rate used',
    example: 680,
  })
  exchangeRate: number;
}

export class ExchangeRatesResponseDto {
  @ApiProperty({
    description: 'USD to XAF exchange rate',
    example: 600,
  })
  USD_TO_XAF: number;

  @ApiProperty({
    description: 'EUR to XAF exchange rate',
    example: 680,
  })
  EUR_TO_XAF: number;

  @ApiProperty({
    description: 'CAD to XAF exchange rate',
    example: 450,
  })
  CAD_TO_XAF: number;
}

export class SupportedCurrenciesResponseDto {
  @ApiProperty({
    description: 'List of supported currencies',
    example: ['USD', 'EUR', 'CAD', 'XAF'],
    type: [String],
  })
  currencies: string[];

  @ApiProperty({
    description: 'Stripe-supported currencies (for processing)',
    example: ['USD', 'EUR', 'CAD'],
    type: [String],
  })
  stripeCurrencies: string[];

  @ApiProperty({
    description: 'Display-only currencies',
    example: ['XAF'],
    type: [String],
  })
  displayCurrencies: string[];
}
