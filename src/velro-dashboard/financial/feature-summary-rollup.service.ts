import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, TransactionSource } from 'generated/prisma/client';

const CURRENCIES = ['eur', 'xaf', 'usd', 'cad'] as const;
const FEATURES = ['sales', 'shopping', 'shipping'] as const;
type FeatureKey = (typeof FEATURES)[number];

const SALES_VOLUME_SOURCES: TransactionSource[] = [
  'TRIP_PAYMENT',
  'TRIP_EARNING',
];
const SHOPPING_VOLUME_SOURCES: TransactionSource[] = [
  'ORDER',
  'SHOPPING_EARNING',
];
const SHIPPING_VOLUME_SOURCES: TransactionSource[] = ['SHIPPING_EARNING'];

const COMMISSION_SOURCES: TransactionSource[] = ['VELRO_FEE', 'COMMISSION'];

interface FeatureCurrencyTotals {
  total: Record<string, number>;
  commission: Record<string, number>;
  count: number;
}

function emptyFeatureTotals(): FeatureCurrencyTotals {
  const total: Record<string, number> = {};
  const commission: Record<string, number> = {};
  for (const c of CURRENCIES) {
    total[c] = 0;
    commission[c] = 0;
  }
  return { total, commission, count: 0 };
}

@Injectable()
export class FeatureSummaryRollupService {
  private readonly logger = new Logger(FeatureSummaryRollupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncFeatureSummary(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('[ROLLUP START] Feature summary sync');

    try {
      const now = new Date();
      const todayKey = this.dateToKey(now);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = this.dateToKey(yesterday);

      await Promise.all([
        this.syncDay(todayKey),
        this.syncDay(yesterdayKey),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(
        `[ROLLUP END] Feature summary sync completed in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[ROLLUP ERROR] Feature summary sync failed after ${duration}ms`,
        error,
      );
    }
  }

  private async syncDay(periodKey: string): Promise<void> {
    const { dayStart, dayEnd } = this.parseDayRange(periodKey);

    const dateFilter = { gte: dayStart, lt: dayEnd };
    const successFilter = { in: ['SUCCESS', 'COMPLETED'] as any };

    const [
      salesVolume,
      salesCommission,
      salesCount,
      shoppingVolume,
      shoppingCommission,
      shoppingCount,
      shippingVolume,
      shippingCommission,
      shippingCount,
    ] = await Promise.all([
      this.sumByCurrency({
        source: { in: SALES_VOLUME_SOURCES },
        status: successFilter,
        createdAt: dateFilter,
      }),
      this.sumByCurrency({
        source: { in: COMMISSION_SOURCES },
        trip_id: { not: null },
        status: successFilter,
        createdAt: dateFilter,
      }),
      this.prisma.transaction.count({
        where: {
          source: { in: SALES_VOLUME_SOURCES },
          status: successFilter,
          createdAt: dateFilter,
        },
      }),
      this.sumByCurrency({
        source: { in: SHOPPING_VOLUME_SOURCES },
        status: successFilter,
        createdAt: dateFilter,
      }),
      this.sumByCurrency({
        source: { in: COMMISSION_SOURCES },
        offer_id: { not: null },
        status: successFilter,
        createdAt: dateFilter,
      }),
      this.prisma.transaction.count({
        where: {
          source: { in: SHOPPING_VOLUME_SOURCES },
          status: successFilter,
          createdAt: dateFilter,
        },
      }),
      this.sumByCurrency({
        source: { in: SHIPPING_VOLUME_SOURCES },
        status: successFilter,
        createdAt: dateFilter,
      }),
      this.sumByCurrency({
        source: { in: COMMISSION_SOURCES },
        shipping_offer_id: { not: null },
        status: successFilter,
        createdAt: dateFilter,
      }),
      this.prisma.transaction.count({
        where: {
          source: { in: SHIPPING_VOLUME_SOURCES },
          status: successFilter,
          createdAt: dateFilter,
        },
      }),
    ]);

    const createInput: Prisma.FeatureSummaryRollupCreateInput = {
      periodKey,
      sales_total_eur: salesVolume.eur,
      sales_total_xaf: salesVolume.xaf,
      sales_total_usd: salesVolume.usd,
      sales_total_cad: salesVolume.cad,
      sales_commission_eur: salesCommission.eur,
      sales_commission_xaf: salesCommission.xaf,
      sales_commission_usd: salesCommission.usd,
      sales_commission_cad: salesCommission.cad,
      sales_count: salesCount,
      shopping_total_eur: shoppingVolume.eur,
      shopping_total_xaf: shoppingVolume.xaf,
      shopping_total_usd: shoppingVolume.usd,
      shopping_total_cad: shoppingVolume.cad,
      shopping_commission_eur: shoppingCommission.eur,
      shopping_commission_xaf: shoppingCommission.xaf,
      shopping_commission_usd: shoppingCommission.usd,
      shopping_commission_cad: shoppingCommission.cad,
      shopping_count: shoppingCount,
      shipping_total_eur: shippingVolume.eur,
      shipping_total_xaf: shippingVolume.xaf,
      shipping_total_usd: shippingVolume.usd,
      shipping_total_cad: shippingVolume.cad,
      shipping_commission_eur: shippingCommission.eur,
      shipping_commission_xaf: shippingCommission.xaf,
      shipping_commission_usd: shippingCommission.usd,
      shipping_commission_cad: shippingCommission.cad,
      shipping_count: shippingCount,
    };

    const { periodKey: _pk, ...updateFields } = createInput;

    await this.prisma.featureSummaryRollup.upsert({
      where: { periodKey },
      create: createInput,
      update: updateFields,
    });
  }

  private async sumByCurrency(
    where: any,
  ): Promise<Record<string, number>> {
    const rows = await this.prisma.transaction.groupBy({
      by: ['currency'],
      where,
      _sum: { amount_paid: true },
    });

    const result: Record<string, number> = {};
    for (const c of CURRENCIES) result[c] = 0;

    for (const row of rows) {
      const ck = row.currency.toLowerCase();
      if (CURRENCIES.includes(ck as any)) {
        result[ck] = Number(row._sum.amount_paid ?? 0);
      }
    }
    return result;
  }

  private dateToKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private parseDayRange(periodKey: string): {
    dayStart: Date;
    dayEnd: Date;
  } {
    const [y, m, d] = periodKey.split('-').map(Number);
    const dayStart = new Date(y, m - 1, d);
    const dayEnd = new Date(y, m - 1, d + 1);
    return { dayStart, dayEnd };
  }
}
