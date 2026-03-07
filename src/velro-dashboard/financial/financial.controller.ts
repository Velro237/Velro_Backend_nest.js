import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FinancialService } from './financial.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  FinancialSummaryForFeatureResponseDto,
  FinancialSummaryForPaymentMethodResponseDto,
  FinancialSummaryResponseDto,
  GetFinancialSummaryOfFeaturesQueryDto,
  GetFinancialSummaryOfPaymentMethodsQueryDto,
} from './dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import {
  GetTransactionDetailsQueryDto,
  QuickActionStatsResponseDto,
  RecentFinancialActivityItemDto,
} from './dto/financial-summary.dto';

@Controller('financial')
@ApiTags('Dashboard - Financial')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, AdminGuard)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get all financial summary',
    description:
      'Get all financial summary. Returns an array of aggregated data. To be placed in the top row of cards.',
  })
  @ApiResponse({
    status: 200,
    description: 'Financial summary retrieved successfully',
    type: FinancialSummaryResponseDto,
  })
  getFinancialSummary(): Promise<FinancialSummaryResponseDto> {
    return this.financialService.getFinancialSummary();
  }

  @Get('summary/payment-methods')
  @ApiOperation({
    summary: 'Get all financial summary for payment method',
    description:
      'Get all financial summary for payment method. Returns an array of aggregated data. To be placed in the 2nd row, 1st card.',
  })
  @ApiResponse({
    status: 200,
    description: 'Financial summary for payment method retrieved successfully',
    type: FinancialSummaryResponseDto,
  })
  getFinancialSummaryForPaymentMethod(
    @Query() query: GetFinancialSummaryOfPaymentMethodsQueryDto,
  ): Promise<FinancialSummaryForPaymentMethodResponseDto> {
    return this.financialService.getFinancialSummaryOfPaymentMethods(query);
  }

  @Get('summary/features')
  @ApiOperation({
    summary: 'Get all financial summary for features',
    description:
      'Get all financial summary for features. Returns an array of aggregated data. To be placed in the 3rd row, 1st card.',
  })
  @ApiResponse({
    status: 200,
    description: 'Financial summary for features retrieved successfully',
    type: FinancialSummaryForFeatureResponseDto,
  })
  getFinancialSummaryForFeatures(
    @Query() query: GetFinancialSummaryOfFeaturesQueryDto,
  ): Promise<FinancialSummaryForFeatureResponseDto> {
    return this.financialService.getFinancialSummaryOfFeatures(query);
  }

  @Get('recent-activities')
  @ApiOperation({
    summary: 'Get recent financial activities',
    description:
      'Get recent financial activities. Returns an array of aggregated data. To be placed in the 4th row, 1st card.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent financial activities retrieved successfully',
    type: [RecentFinancialActivityItemDto],
  })
  getRecentFinancialActivities(): Promise<RecentFinancialActivityItemDto[]> {
    return this.financialService.getRecentFinancialActivities();
  }

  @Get('summary/quick-action-stats')
  @ApiOperation({
    summary: 'Get quick action stats',
    description:
      'Get quick action stats. Returns an array of aggregated data. To be placed in the 4th row, 2nd card.',
  })
  @ApiResponse({
    status: 200,
    description: 'Quick action stats retrieved successfully',
    type: QuickActionStatsResponseDto,
  })
  getQuickActionStats(): Promise<QuickActionStatsResponseDto> {
    return this.financialService.getQuickActionStats();
  }

  @Get('transaction')
  @ApiOperation({
    summary: 'Get transaction details',
    description: 'Get transaction details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully',
  })
  getTransactionDetails(@Query() query: GetTransactionDetailsQueryDto) {
    return this.financialService.getTransactionDetails(query);
  }
}
