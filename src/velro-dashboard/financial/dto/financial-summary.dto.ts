import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Currency, TransactionStatus, TransactionType } from 'generated/prisma';
import { Decimal } from 'generated/prisma/runtime/library';
import { PaginationQueryDto } from 'src/wallet/dto/wallet.dto';

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

export class RecentFinancialActivityUserDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  picture: string;
  @ApiProperty()
  firstName: string;
  @ApiProperty()
  lastName: string;
}

export class RecentFinancialActivityItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user: RecentFinancialActivityUserDto;

  @ApiProperty()
  type: TransactionType;

  @ApiProperty()
  amount_requested: Decimal;

  @ApiProperty()
  amount_paid: Decimal;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ type: Date })
  createdAt: Date;
}

export class QuickActionStatsResponseDto {
  @ApiProperty()
  pending: number;
  @ApiProperty()
  onHold: number;
  @ApiProperty()
  disputes: number;
}

export class GetTransactionDetailsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search: string;
  @ApiPropertyOptional({ enum: TransactionType })
  @IsEnum(TransactionType)
  @IsOptional()
  type: TransactionType;
  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsEnum(TransactionStatus)
  @IsOptional()
  status: TransactionStatus;
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  service: string; // TODO: Allow per-service transactions, currently no-ops
}
