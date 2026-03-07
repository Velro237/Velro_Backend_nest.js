import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  FinancialSummaryResponseDto,
  FinancialSummaryItemDto,
  FinancialSummaryForPaymentMethodResponseDto,
} from './dto';
import { Currency, FinancialSummaryRollup } from 'generated/prisma/client';
import {
  FinancialSummaryForFeatureResponseDto,
  FinancialSummaryOfFeatureItemDto,
  FinancialSummaryOfPaymentMethodItemDto,
  GetFinancialSummaryOfFeaturesQueryDto,
  GetFinancialSummaryOfPaymentMethodsQueryDto,
  RecentFinancialActivityItemDto,
} from './dto/financial-summary.dto';

const METRICS = [
  'totalVolume',
  'escrowHeld',
  'availableToWithdraw',
  'pendingWithdrawals',
  'commissionEarned',
] as const;
type MetricName = (typeof METRICS)[number];

const CURRENCIES = ['eur', 'usd', 'xaf', 'cad'] as const;

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
      totalVolume: this.emptyFinancialSummaryItem(),
      escrowHeld: this.emptyFinancialSummaryItem(),
      availableToWithdraw: this.emptyFinancialSummaryItem(),
      pendingWithdrawals: this.emptyFinancialSummaryItem(),
      commissionEarned: this.emptyFinancialSummaryItem(),
    };

    if (!currentRow) {
      this.logger.warn('No current rollup data found — returning zeros');
      return result;
    }

    for (const metric of METRICS) {
      const currentItem = this.extractFinancialSummaryItem(currentRow, metric);
      const prevItem = previousRow
        ? this.extractFinancialSummaryItem(previousRow, metric)
        : null;
      const trendPct = prevItem
        ? this.computeFinancialSummaryTrend(
            this.sumFinancialSummaryValues(currentItem),
            this.sumFinancialSummaryValues(prevItem),
          )
        : 0;

      result[metric] = { ...currentItem, trendPct };
    }

    return result;
  }

  async getFinancialSummaryOfFeatures(
    query: GetFinancialSummaryOfFeaturesQueryDto,
  ): Promise<FinancialSummaryForFeatureResponseDto> {
    const days = query.days ?? 30;
    const cur = (query.currency ?? Currency.XAF).toLowerCase();
    const { startKey, endKey } = this.dayRange(days);

    const rows = await this.prisma.featureSummaryRollup.findMany({
      where: { periodKey: { gte: startKey, lte: endKey } },
    });

    const features = ['sales', 'shopping', 'shipping'] as const;
    const sums: Record<
      string,
      { total: number; commission: number; count: number }
    > = {};
    for (const f of features) sums[f] = { total: 0, commission: 0, count: 0 };

    for (const row of rows) {
      for (const f of features) {
        sums[f].total += Number((row as any)[`${f}_total_${cur}`] ?? 0);
        sums[f].commission += Number(
          (row as any)[`${f}_commission_${cur}`] ?? 0,
        );
        sums[f].count += (row as any)[`${f}_count`] ?? 0;
      }
    }

    const toItem = (f: string): FinancialSummaryOfFeatureItemDto => ({
      totalAmt: Math.round(sums[f].total * 100) / 100,
      commissionAmt: Math.round(sums[f].commission * 100) / 100,
      transactionCount: sums[f].count,
    });

    return {
      sales: toItem('sales'),
      shopping: toItem('shopping'),
      shipping: toItem('shipping'),
      marketplace: this.emptyFinancialSummaryOfFeatureItem(),
    };
  }

  async getFinancialSummaryOfPaymentMethods(
    query: GetFinancialSummaryOfPaymentMethodsQueryDto,
  ): Promise<FinancialSummaryForPaymentMethodResponseDto> {
    const days = query.days ?? 30;
    const cur = (query.currency ?? Currency.XAF).toLowerCase();
    const { startKey, endKey } = this.dayRange(days);

    const rows = await this.prisma.paymentMethodRollup.findMany({
      where: { periodKey: { gte: startKey, lte: endKey } },
    });

    const providers = ['stripe', 'mtn', 'orange', 'paypal'] as const;
    const totals: Record<string, number> = {};
    for (const p of providers) totals[p] = 0;

    for (const row of rows) {
      for (const p of providers) {
        totals[p] += Number((row as any)[`${p}_${cur}`] ?? 0);
      }
    }

    const grandTotal = providers.reduce((s, p) => s + totals[p], 0);
    const queryCurrency = (query.currency ?? Currency.XAF) as Currency;

    const pct = (p: string) =>
      grandTotal > 0 ? Math.round((totals[p] / grandTotal) * 10000) / 100 : 0;

    const toItem = (p: string): FinancialSummaryOfPaymentMethodItemDto => ({
      totalAmt: Math.round(totals[p] * 100) / 100,
      currency: queryCurrency,
      portionPct: pct(p),
    });

    return {
      stripe: toItem('stripe'),
      mtn: toItem('mtn'),
      orange: toItem('orange'),
      paypal: toItem('paypal'),
    };
  }

  async getRecentFinancialActivities(): Promise<
    RecentFinancialActivityItemDto[]
  > {
    const activities = await this.prisma.transaction.findMany({
      select: {
        id: true,
        type: true,
        amount_requested: true,
        amount_paid: true,
        currency: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            picture: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return activities.map((item) => ({
      ...item,
      currency: item.currency as Currency,
    }));
  }

  private dayRange(days: number): { startKey: string; endKey: string } {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { startKey: fmt(start), endKey: fmt(end) };
  }

  private emptyFinancialSummaryOfPaymentMethodItem(): FinancialSummaryOfPaymentMethodItemDto {
    return { currency: Currency.XAF, portionPct: 0, totalAmt: 0 };
  }

  private emptyFinancialSummaryOfFeatureItem(): FinancialSummaryOfFeatureItemDto {
    return { totalAmt: 0, transactionCount: 0, commissionAmt: 0 };
  }

  private emptyFinancialSummaryItem(): FinancialSummaryItemDto {
    return { eur: 0, usd: 0, xaf: 0, cad: 0, trendPct: 0 };
  }

  private col(metric: MetricName, currency: string): string {
    return `${metric}_${currency}`;
  }

  private extractFinancialSummaryItem(
    row: FinancialSummaryRollup,
    metric: MetricName,
  ): Omit<FinancialSummaryItemDto, 'trendPct'> {
    const item: any = {};
    for (const c of CURRENCIES) {
      item[c] = Number((row as any)[this.col(metric, c)] ?? 0);
    }
    return item;
  }

  private computeFinancialSummaryTrend(
    current: number,
    previous: number,
  ): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return (
      Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100
    );
  }

  private sumFinancialSummaryValues(
    item: Omit<FinancialSummaryItemDto, 'trendPct'>,
  ): number {
    return item.cad + item.eur + item.usd + item.xaf;
  }
}
