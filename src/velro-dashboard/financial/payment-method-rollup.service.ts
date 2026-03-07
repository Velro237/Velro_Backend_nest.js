import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'generated/prisma/client';

const PROVIDERS = ['stripe', 'mtn', 'orange', 'paypal'] as const;
const CURRENCIES = ['eur', 'xaf', 'usd', 'cad'] as const;

type ProviderKey = (typeof PROVIDERS)[number];

function providerToKey(provider: string): ProviderKey | null {
  const lower = provider.toLowerCase() as ProviderKey;
  return PROVIDERS.includes(lower) ? lower : null;
}

@Injectable()
export class PaymentMethodRollupService {
  private readonly logger = new Logger(PaymentMethodRollupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncPaymentMethods(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('[ROLLUP START] Payment method sync');

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
        `[ROLLUP END] Payment method sync completed in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[ROLLUP ERROR] Payment method sync failed after ${duration}ms`,
        error,
      );
    }
  }

  private async syncDay(periodKey: string): Promise<void> {
    const { dayStart, dayEnd } = this.parseDayRange(periodKey);

    const rows = await this.prisma.transaction.groupBy({
      by: ['provider', 'currency'],
      where: {
        status: { in: ['SUCCESS', 'COMPLETED'] },
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      _sum: { amount_paid: true },
      _count: true,
    });

    const data: Record<string, number> = {};

    for (const p of PROVIDERS) {
      for (const c of CURRENCIES) {
        data[`${p}_${c}`] = 0;
      }
      data[`${p}_count`] = 0;
    }

    for (const row of rows) {
      const pk = providerToKey(row.provider);
      if (!pk) continue;
      const ck = row.currency.toLowerCase();
      if (CURRENCIES.includes(ck as any)) {
        data[`${pk}_${ck}`] += Number(row._sum.amount_paid ?? 0);
      }
      data[`${pk}_count`] += row._count;
    }

    const createInput: Prisma.PaymentMethodRollupCreateInput = {
      periodKey,
      stripe_eur: data.stripe_eur,
      stripe_xaf: data.stripe_xaf,
      stripe_usd: data.stripe_usd,
      stripe_cad: data.stripe_cad,
      stripe_count: data.stripe_count,
      mtn_eur: data.mtn_eur,
      mtn_xaf: data.mtn_xaf,
      mtn_usd: data.mtn_usd,
      mtn_cad: data.mtn_cad,
      mtn_count: data.mtn_count,
      orange_eur: data.orange_eur,
      orange_xaf: data.orange_xaf,
      orange_usd: data.orange_usd,
      orange_cad: data.orange_cad,
      orange_count: data.orange_count,
      paypal_eur: data.paypal_eur,
      paypal_xaf: data.paypal_xaf,
      paypal_usd: data.paypal_usd,
      paypal_cad: data.paypal_cad,
      paypal_count: data.paypal_count,
    };

    const { periodKey: _pk, ...updateFields } = createInput;

    await this.prisma.paymentMethodRollup.upsert({
      where: { periodKey },
      create: createInput,
      update: updateFields,
    });
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
