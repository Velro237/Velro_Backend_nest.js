import { Module } from '@nestjs/common';
import { VelroDashboardService } from './velro-dashboard.service';
import { VelroDashboardController } from './velro-dashboard.controller';
import {
  FinancialController,
  FinancialService,
  FinancialRollupService,
} from './financial';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VelroDashboardController, FinancialController],
  providers: [VelroDashboardService, FinancialService, FinancialRollupService],
  exports: [FinancialRollupService],
})
export class VelroDashboardModule {}
