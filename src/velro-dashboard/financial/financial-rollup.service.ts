import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, TransactionSource } from 'generated/prisma/client';

const VOLUME_SOURCES = [
  'ORDER',
  'TRIP_PAYMENT',
  'TRIP_EARNING',
  'SHOPPING_EARNING',
  'SHIPPING_EARNING',
] as const;

const COMMISSION_SOURCES = ['VELRO_FEE', 'COMMISSION'] as const;

interface CurrencyTotals {
  eur: number;
  usd: number;
  xaf: number;
  cad: number;
}

function emptyCurrencyTotals(): CurrencyTotals {
  return { eur: 0, usd: 0, xaf: 0, cad: 0 };
}

function setCurrency(totals: CurrencyTotals, currency: string, amount: number) {
  const key = currency.toLowerCase() as keyof CurrencyTotals;
  if (key in totals) {
    totals[key] += amount;
  }
}

@Injectable()
export class FinancialRollupService {
  private readonly logger = new Logger(FinancialRollupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncFinancial(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('[ROLLUP START] Financial summary sync');

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const [
        volumeByCurrency,
        commissionByCurrency,
        walletAggregates,
        pendingWithdrawals,
      ] = await Promise.all([
        this.aggregateTransactionsByCurrency(monthStart, [...VOLUME_SOURCES]),
        this.aggregateTransactionsByCurrency(monthStart, [
          ...COMMISSION_SOURCES,
        ]),
        this.aggregateWalletBalances(),
        this.aggregatePendingWithdrawals(),
      ]);

      const data: Prisma.FinancialSummaryRollupCreateInput = {
        periodKey: 'current',
        totalVolume_eur: volumeByCurrency.eur,
        totalVolume_usd: volumeByCurrency.usd,
        totalVolume_xaf: volumeByCurrency.xaf,
        totalVolume_cad: volumeByCurrency.cad,
        escrowHeld_eur: walletAggregates.hold.eur,
        escrowHeld_usd: walletAggregates.hold.usd,
        escrowHeld_xaf: walletAggregates.hold.xaf,
        escrowHeld_cad: walletAggregates.hold.cad,
        availableToWithdraw_eur: walletAggregates.available.eur,
        availableToWithdraw_usd: walletAggregates.available.usd,
        availableToWithdraw_xaf: walletAggregates.available.xaf,
        availableToWithdraw_cad: walletAggregates.available.cad,
        pendingWithdrawals_eur: pendingWithdrawals.eur,
        pendingWithdrawals_usd: pendingWithdrawals.usd,
        pendingWithdrawals_xaf: pendingWithdrawals.xaf,
        pendingWithdrawals_cad: pendingWithdrawals.cad,
        commissionEarned_eur: commissionByCurrency.eur,
        commissionEarned_usd: commissionByCurrency.usd,
        commissionEarned_xaf: commissionByCurrency.xaf,
        commissionEarned_cad: commissionByCurrency.cad,
      };

      this.logger.log(`[ROLLUP] Data: ${JSON.stringify(data)}`);

      const { periodKey: _pk, ...updateFields } = data;

      await this.prisma.$transaction([
        this.prisma.financialSummaryRollup.upsert({
          where: { periodKey: 'current' },
          create: data,
          update: updateFields,
        }),
        this.prisma.financialSummaryRollup.upsert({
          where: { periodKey: periodMonth },
          create: { ...data, periodKey: periodMonth },
          update: updateFields,
        }),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(
        `[ROLLUP END] Financial summary sync completed in ${duration}ms (period: ${periodMonth})`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[ROLLUP ERROR] Financial summary sync failed after ${duration}ms`,
        error,
      );
    }
  }

  /**
   * Sum transaction amounts grouped by currency for given sources within the period.
   * Only counts successful transactions (SUCCESS or COMPLETED).
   */
  private async aggregateTransactionsByCurrency(
    periodStart: Date,
    sources: string[],
  ): Promise<CurrencyTotals> {
    this.logger.log(
      `[ROLLUP] Aggregating transactions by currency for sources: ${sources.join(', ')}`,
    );
    const rows = await this.prisma.transaction.groupBy({
      by: ['currency'],
      where: {
        source: { in: sources as TransactionSource[] },
        status: { in: ['SUCCESS', 'COMPLETED'] },
        createdAt: { gte: periodStart },
      },
      _sum: { amount_paid: true },
    });

    this.logger.log(
      `[ROLLUP] Aggregated transactions by currency: ${JSON.stringify(rows)}`,
    );

    const totals = emptyCurrencyTotals();
    for (const row of rows) {
      setCurrency(totals, row.currency, Number(row._sum.amount_paid ?? 0));
    }

    this.logger.log(
      `[ROLLUP] Aggregated transactions by currency: ${JSON.stringify(totals)}`,
    );
    return totals;
  }

  /**
   * Sum all wallet hold and available balances across all wallets (point-in-time snapshot).
   */
  private async aggregateWalletBalances(): Promise<{
    hold: CurrencyTotals;
    available: CurrencyTotals;
  }> {
    this.logger.log(`[ROLLUP] Aggregating wallet balances`);
    const result = await this.prisma.wallet.aggregate({
      _sum: {
        hold_balance_eur: true,
        hold_balance_usd: true,
        hold_balance_xaf: true,
        hold_balance_cad: true,
        available_balance_eur: true,
        available_balance_usd: true,
        available_balance_xaf: true,
        available_balance_cad: true,
      },
    });

    this.logger.log(
      `[ROLLUP] Aggregated wallet balances: ${JSON.stringify(result)}`,
    );

    const s = result._sum;
    return {
      hold: {
        eur: Number(s.hold_balance_eur ?? 0),
        usd: Number(s.hold_balance_usd ?? 0),
        xaf: Number(s.hold_balance_xaf ?? 0),
        cad: Number(s.hold_balance_cad ?? 0),
      },
      available: {
        eur: Number(s.available_balance_eur ?? 0),
        usd: Number(s.available_balance_usd ?? 0),
        xaf: Number(s.available_balance_xaf ?? 0),
        cad: Number(s.available_balance_cad ?? 0),
      },
    };
  }

  /**
   * Sum pending withdrawal amounts grouped by currency.
   */
  private async aggregatePendingWithdrawals(): Promise<CurrencyTotals> {
    this.logger.log(`[ROLLUP] Aggregating pending withdrawals`);
    const rows = await this.prisma.transaction.groupBy({
      by: ['currency'],
      where: {
        type: 'DEBIT',
        source: 'WITHDRAW',
        status: { in: ['PENDING', 'PENDIND', 'IN_PROGRES'] },
      },
      _sum: { amount_requested: true },
    });

    this.logger.log(
      `[ROLLUP] Aggregated pending withdrawals: ${JSON.stringify(rows)}`,
    );

    const totals = emptyCurrencyTotals();
    for (const row of rows) {
      setCurrency(totals, row.currency, Number(row._sum.amount_requested ?? 0));
    }

    this.logger.log(
      `[ROLLUP] Aggregated pending withdrawals: ${JSON.stringify(totals)}`,
    );
    return totals;
  }
}
