import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { EntitlementSource } from '@app/finance/common/finance.enums';
import { toBigInt } from '@app/finance/common/prisma.utils';
import type { FinanceEntitlementSource, FinanceOrderItem, Prisma } from '@prisma/client';

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async hasPurchased(userId: string, productId: string): Promise<boolean> {
    const entitlement = await this.prisma.financeEntitlement.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: toBigInt(productId),
        },
      },
      select: { id: true },
    });
    return Boolean(entitlement);
  }

  async grantPurchaseEntitlements(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    items: FinanceOrderItem[],
    purchasedAt: Date,
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }
    const productIds = Array.from(
      new Set(items.map((item) => item.productId)),
    );

    await Promise.all(
      productIds.map((productId) =>
        tx.financeEntitlement.upsert({
          where: {
            userId_productId: {
              userId,
              productId,
            },
          },
          create: {
            userId,
            productId,
            source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
            orderId,
            purchasedAt,
          },
          update: {
            source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
            orderId,
            purchasedAt,
          },
        }),
      ),
    );
  }
}
