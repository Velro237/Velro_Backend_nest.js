import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Currency } from 'generated/prisma';

export class FinancialSummaryItemDto {
  @ApiProperty()
  eur: number;
  @ApiProperty()
  usd: number;
  @ApiProperty()
  xaf: number;
  @ApiProperty()
  cad: number;
  @ApiPropertyOptional()
  trendPct: number;
}

export class FinancialSummaryResponseDto {
  @ApiProperty()
  totalVolume: FinancialSummaryItemDto;
  @ApiProperty()
  escrowHeld: FinancialSummaryItemDto;
  @ApiProperty()
  availableToWithdraw: FinancialSummaryItemDto;
  @ApiProperty()
  pendingWithdrawals: FinancialSummaryItemDto;
  @ApiProperty()
  commissionEarned: FinancialSummaryItemDto;
}

export class FinancialSummaryOfFeatureItemDto {
  @ApiProperty()
  totalAmt: number;
  @ApiProperty()
  transactionCount: number;
  @ApiProperty()
  commissionAmt: number;
}

export class FinancialSummaryOfPaymentMethodItemDto {
  @ApiProperty()
  totalAmt: number;
  @ApiProperty()
  currency: Currency;
  @ApiPropertyOptional()
  portionPct: number;
}

export class FinancialSummaryForFeatureResponseDto {
  @ApiProperty()
  sales: FinancialSummaryOfFeatureItemDto;
  @ApiProperty()
  shopping: FinancialSummaryOfFeatureItemDto;
  @ApiProperty()
  shipping: FinancialSummaryOfFeatureItemDto;
  @ApiProperty()
  marketplace: FinancialSummaryOfFeatureItemDto;
}

export class FinancialSummaryForPaymentMethodResponseDto {
  @ApiProperty()
  stripe: FinancialSummaryOfPaymentMethodItemDto;
  @ApiProperty()
  mtn: FinancialSummaryOfPaymentMethodItemDto;
  @ApiProperty()
  orange: FinancialSummaryOfPaymentMethodItemDto;
  @ApiProperty()
  paypal: FinancialSummaryOfPaymentMethodItemDto;
}

export class GetFinancialSummaryOfPaymentMethodsQueryDto {
  @ApiPropertyOptional({ default: 30 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(7)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ enum: Currency, default: Currency.XAF })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}

export class GetFinancialSummaryOfFeaturesQueryDto extends GetFinancialSummaryOfPaymentMethodsQueryDto {}
