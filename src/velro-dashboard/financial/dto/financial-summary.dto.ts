import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
