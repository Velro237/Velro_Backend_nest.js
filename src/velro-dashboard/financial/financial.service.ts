import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FinancialSummaryResponseDto, FinancialSummaryItemDto } from './dto';
import { FinancialSummaryRollup } from 'generated/prisma/client';

const METRICS = [
  'totalVolume',
  'escrowHeld',
  'availableToWithdraw',
  'pendingWithdrawals',
  'commissionEarned',
] as const;
type MetricName = (typeof METRICS)[number];

const CURRENCIES = ['eur', 'usd', 'xaf', 'cad'] as const;

function emptyItem(): FinancialSummaryItemDto {
  return { eur: 0, usd: 0, xaf: 0, cad: 0, trendPct: 0 };
}

function col(metric: MetricName, currency: string): string {
  return `${metric}_${currency}`;
}

function extractItem(
  row: FinancialSummaryRollup,
  metric: MetricName,
): Omit<FinancialSummaryItemDto, 'trendPct'> {
  const item: any = {};
  for (const c of CURRENCIES) {
    item[c] = Number((row as any)[col(metric, c)] ?? 0);
  }
  return item;
}

function computeTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100;
}

function sumValues(item: Omit<FinancialSummaryItemDto, 'trendPct'>): number {
  return item.cad + item.eur + item.usd + item.xaf;
}

@Injectable()
export class FinancialService {
  private readonly logger = new Logger(FinancialService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getFinancialSummary(): Promise<FinancialSummaryResponseDto> {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevPeriodKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    const [currentRow, previousRow] = await Promise.all([
      this.prisma.financialSummaryRollup.findUnique({
        where: { periodKey: 'current' },
      }),
      this.prisma.financialSummaryRollup.findUnique({
        where: { periodKey: prevPeriodKey },
      }),
    ]);

    const result: FinancialSummaryResponseDto = {
      totalVolume: emptyItem(),
      escrowHeld: emptyItem(),
      availableToWithdraw: emptyItem(),
      pendingWithdrawals: emptyItem(),
      commissionEarned: emptyItem(),
    };

    if (!currentRow) {
      this.logger.warn('No current rollup data found — returning zeros');
      return result;
    }

    for (const metric of METRICS) {
      const currentItem = extractItem(currentRow, metric);
      const prevItem = previousRow ? extractItem(previousRow, metric) : null;
      const trendPct = prevItem
        ? computeTrend(sumValues(currentItem), sumValues(prevItem))
        : 0;

      result[metric] = { ...currentItem, trendPct };
    }

    return result;
  }
}
