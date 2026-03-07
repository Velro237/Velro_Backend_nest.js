import { Controller, Get, UseGuards } from '@nestjs/common';
import { FinancialService } from './financial.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FinancialSummaryResponseDto } from './dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';

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
}
