import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { ProductsService } from '@app/finance/products/products.service';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import {
  EntitlementSource,
  OrderStatus,
  ProductPricingType,
  SubscriptionPlanCode,
} from '@app/finance/common/finance.enums';
import { BASE_FREE_DAILY_LIMIT } from '@app/finance/common/finance.constants';
import { getTehranDateKey } from '@app/finance/common/date.utils';
import type {
  DownloadDecisionDto,
  QuotaStatusDto,
} from '@app/finance/downloads/dto/download-response.dto';
import { toBigInt } from '@app/finance/common/prisma.utils';
import { StorageService } from '@app/catalog/storage/storage.service';
import { Readable } from 'node:stream';
import type { FinanceEntitlementSource, Prisma } from '@prisma/client';

@Injectable()
export class DownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly storage: StorageService,
  ) {}

  async getTodayQuota(userId: string): Promise<QuotaStatusDto> {
    const dateKey = getTehranDateKey();
    const subscription = await this.subscriptionsService.getActiveSubscription(
      userId,
    );
    const usage = await this.prisma.financeDownloadUsageDaily.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
    });

    const usedFree = usage?.usedFree ?? 0;
    const usedSub = usage?.usedSub ?? 0;

    if (!subscription) {
      return {
        usedFree,
        freeLimit: BASE_FREE_DAILY_LIMIT,
        usedSub,
        subLimit: 0,
        hasSubscription: false,
      };
    }

    const plan = await this.subscriptionsService.getPlanById(
      subscription.planId,
    );

    return {
      usedFree,
      freeLimit: plan.dailyFreeLimit,
      usedSub,
      subLimit: plan.dailySubLimit,
      hasSubscription: true,
      planCode: plan.code as SubscriptionPlanCode,
    };
  }

  async downloadProduct(
    userId: string,
    productId: string,
  ): Promise<DownloadDecisionDto> {
    const product = await this.productsService.findProductOrThrow(productId);
    const storageKey = await this.productsService.getProductStorageKey(productId);

    const hasEntitlement = await this.entitlementsService.hasPurchased(
      userId,
      productId,
    );

    if (hasEntitlement) {
      await this.prisma.financeDownloadLog.create({
        data: {
          userId,
          productId: toBigInt(productId),
          dateKey: getTehranDateKey(),
          source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
          subscriptionId: null,
          orderId: null,
        },
      });
      return {
        allowed: true,
        source: EntitlementSource.PURCHASED,
        reason: 'PURCHASED',
        productType: product.pricingType,
        signedUrl: null,
        storageKey,
      };
    }

    if (product.pricingType === ProductPricingType.PAID) {
      throw new ForbiddenException('Product requires purchase.');
    }

    if (product.pricingType === ProductPricingType.PAID_OR_SUBSCRIPTION) {
      const subscription = await this.subscriptionsService.getActiveSubscription(
        userId,
      );
      if (!subscription) {
        throw new ForbiddenException('Active subscription required.');
      }
      const plan = await this.subscriptionsService.getPlanById(
        subscription.planId,
      );
      return this.consumeQuota({
        userId,
        productId,
        type: 'sub',
        limit: plan.dailySubLimit,
        source: EntitlementSource.SUB_QUOTA,
        subscriptionId: subscription.id,
        productType: product.pricingType,
        storageKey,
      });
    }

    if (product.pricingType === ProductPricingType.FREE) {
      const subscription = await this.subscriptionsService.getActiveSubscription(
        userId,
      );
      const plan = subscription
        ? await this.subscriptionsService.getPlanById(subscription.planId)
        : null;
      const limit = subscription
        ? plan?.dailyFreeLimit ?? BASE_FREE_DAILY_LIMIT
        : BASE_FREE_DAILY_LIMIT;

      return this.consumeQuota({
        userId,
        productId,
        type: 'free',
        limit,
        source: EntitlementSource.FREE_QUOTA,
        subscriptionId: subscription ? subscription.id : null,
        productType: product.pricingType,
        storageKey,
      });
    }

    throw new BadRequestException('Unsupported product type.');
  }

  private async consumeQuota(params: {
    userId: string;
    productId: string;
    type: 'free' | 'sub';
    limit: number;
    source: EntitlementSource;
    subscriptionId: string | null;
    productType: ProductPricingType;
    storageKey: string | null;
  }): Promise<DownloadDecisionDto> {
    const dateKey = getTehranDateKey();

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.financeDownloadUsageDaily.upsert({
        where: { userId_dateKey: { userId: params.userId, dateKey } },
        create: {
          userId: params.userId,
          dateKey,
          usedFree: 0,
          usedSub: 0,
        },
        update: {},
      });

      if (params.type === 'free') {
        const result = await tx.financeDownloadUsageDaily.updateMany({
          where: {
            userId: params.userId,
            dateKey,
            usedFree: { lt: params.limit },
          },
          data: { usedFree: { increment: 1 } },
        });
        if (result.count === 0) {
          throw new ForbiddenException('Daily free quota exceeded.');
        }
      } else {
        const result = await tx.financeDownloadUsageDaily.updateMany({
          where: {
            userId: params.userId,
            dateKey,
            usedSub: { lt: params.limit },
          },
          data: { usedSub: { increment: 1 } },
        });
        if (result.count === 0) {
          throw new ForbiddenException('Daily subscription quota exceeded.');
        }
      }

      await tx.financeDownloadLog.create({
        data: {
          userId: params.userId,
          productId: toBigInt(params.productId),
          dateKey,
          source: params.source as FinanceEntitlementSource,
          subscriptionId: params.subscriptionId,
          orderId: null,
        },
      });

      const decision: DownloadDecisionDto = {
        allowed: true,
        source: params.source,
        reason: params.source,
        productType: params.productType,
        signedUrl: params.storageKey
          ? this.storage.getDownloadUrl(params.storageKey)
          : null,
        storageKey: params.storageKey,
      };
      return decision;
    });
  }

  async getOrderFileDownload(params: {
    userId: string;
    orderId: string;
    fileId: string;
  }): Promise<{
    stream: Readable;
    filename: string;
    mimeType?: string;
    size?: number;
  }> {
    const fileId = toBigInt(params.fileId);
    const file = await this.prisma.productFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        productId: true,
        storageKey: true,
        originalName: true,
        sourceFile: { select: { filename: true, mime: true, size: true } },
      },
    });
    if (!file) {
      throw new NotFoundException('File not found.');
    }

    const order = await this.prisma.financeOrder.findUnique({
      where: { id: params.orderId },
      select: { status: true, userId: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.userId !== params.userId) {
      throw new ForbiddenException('Access denied.');
    }
    if ((order.status as OrderStatus) !== OrderStatus.PAID) {
      throw new ForbiddenException('Order is not paid.');
    }

    const item = await this.prisma.financeOrderItem.findFirst({
      where: { orderId: params.orderId, productId: file.productId },
      select: { id: true },
    });
    if (!item) {
      throw new ForbiddenException('File is not part of this order.');
    }

    const entitlement = await this.prisma.financeEntitlement.findFirst({
      where: {
        userId: params.userId,
        productId: file.productId,
        orderId: params.orderId,
        source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
      },
      select: { id: true },
    });
    if (!entitlement) {
      throw new ForbiddenException('Entitlement not found.');
    }

    await this.prisma.financeDownloadLog.create({
      data: {
        userId: params.userId,
        productId: file.productId,
        dateKey: getTehranDateKey(),
        source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
        subscriptionId: null,
        orderId: params.orderId,
      },
    });

    const filename =
      file.originalName ??
      file.sourceFile?.filename ??
      `product-${file.productId.toString()}`;

    return {
      stream: this.storage.getDownloadStream(file.storageKey),
      filename,
      mimeType: file.sourceFile?.mime ?? undefined,
      size:
        file.sourceFile?.size !== null && file.sourceFile?.size !== undefined
          ? Number(file.sourceFile.size)
          : undefined,
    };
  }
}
