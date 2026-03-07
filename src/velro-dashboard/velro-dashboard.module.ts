import { Module } from '@nestjs/common';
import { VelroDashboardService } from './velro-dashboard.service';
import { VelroDashboardController } from './velro-dashboard.controller';
import {
  FinancialController,
  FinancialService,
  FinancialRollupService,
  PaymentMethodRollupService,
  FeatureSummaryRollupService,
} from './financial';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VelroDashboardController, FinancialController],
  providers: [
    VelroDashboardService,
    FinancialService,
    FinancialRollupService,
    PaymentMethodRollupService,
    FeatureSummaryRollupService,
  ],
  exports: [
    FinancialRollupService,
    PaymentMethodRollupService,
    FeatureSummaryRollupService,
  ],
})
export class VelroDashboardModule {}
