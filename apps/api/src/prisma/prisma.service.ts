import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService (Prisma 6.x compatible)
 * Standard NestJS wrapper around PrismaClient
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.assertSubscriptionPurchaseSchema();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  private async assertSubscriptionPurchaseSchema(): Promise<void> {
    const result = await this.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'finance'
          AND table_name = 'subscription_purchases'
          AND column_name = 'subscription_plan_id'
      ) AS "exists";
    `;

    if (!result[0]?.exists) {
      throw new Error(
        'Database schema mismatch: finance.subscription_purchases.subscription_plan_id is missing. ' +
          'Apply migration 20260202000000_subscription_purchase_plan_fk_hotfix (prisma migrate deploy).',
      );
    }
  }
}

/**
 * Proper transaction client type for Prisma 6.x
 *
 * Prisma’s $transaction callback receives an instance of PrismaClient
 * with the ITXClientDenyList removed.
 */
export type PrismaTxClient = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0];
