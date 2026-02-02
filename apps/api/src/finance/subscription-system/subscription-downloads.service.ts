import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { ProductsService } from '@app/finance/products/products.service';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';
import { UserSubscriptionsService } from '@app/finance/subscription-system/user-subscriptions.service';
import { StorageService } from '@app/catalog/storage/storage.service';
import { ProductPricingType } from '@app/finance/common/finance.enums';
import { getTehranDateKey } from '@app/finance/common/date.utils';
import { SUBSCRIPTION_BASE_FREE_DAILY_LIMIT } from '@app/finance/subscription-system/subscription-system.constants';
import { SubscriptionDownloadType } from '@app/finance/subscription-system/subscription-system.enums';
import { toBigInt } from '@app/finance/common/prisma.utils';
import type { SubscriptionDownloadDecisionDto } from '@app/finance/subscription-system/dto/subscription-download-decision.dto';
import type { Prisma } from '@prisma/client';

@Injectable()
export class SubscriptionDownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly subscriptionsService: UserSubscriptionsService,
    private readonly storage: StorageService,
  ) {}

  async validateDownload(
    userId: string,
    productId: string,
  ): Promise<SubscriptionDownloadDecisionDto> {
    const product = await this.productsService.findProductOrThrow(productId);
    const storageKey = await this.productsService.getProductStorageKey(productId);
    const hasEntitlement = await this.entitlementsService.hasPurchased(
      userId,
      productId,
    );
    if (hasEntitlement) {
      return this.buildPurchaseDecision(storageKey);
    }
    const subscription = await this.subscriptionsService.getActiveSubscription(userId);

    if (product.pricingType === ProductPricingType.PAID) {
      throw new ForbiddenException('Product requires purchase.');
    }

    if (product.pricingType === ProductPricingType.PAID_OR_SUBSCRIPTION) {
      if (!subscription) {
        throw new ForbiddenException('Active subscription required.');
      }
      return this.consumeQuota({
        userId,
        productId,
        subscriptionId: subscription.id,
        downloadType: SubscriptionDownloadType.SUBSCRIPTION,
        limit: subscription.dailySubscriptionDownloadLimit,
        storageKey,
      });
    }

    if (product.pricingType === ProductPricingType.FREE) {
      const limit = subscription
        ? subscription.dailyFreeDownloadLimitWithSubscription
        : SUBSCRIPTION_BASE_FREE_DAILY_LIMIT;

      return this.consumeQuota({
        userId,
        productId,
        subscriptionId: null,
        downloadType: SubscriptionDownloadType.FREE,
        limit,
        storageKey,
      });
    }

    throw new BadRequestException('Unsupported product type.');
  }

  private async consumeQuota(params: {
    userId: string;
    productId: string;
    subscriptionId: string | null;
    downloadType: SubscriptionDownloadType;
    limit: number;
    storageKey: string | null;
  }): Promise<SubscriptionDownloadDecisionDto> {
    const dateKey = getTehranDateKey();

    return this.prisma.$transaction(async (tx) => {
      const used = await tx.subscriptionDownloadLog.count({
        where: {
          userId: params.userId,
          dateKey,
          downloadType: params.downloadType,
        },
      });

      if (used >= params.limit) {
        if (params.downloadType === SubscriptionDownloadType.SUBSCRIPTION) {
          throw new ForbiddenException('Daily subscription quota exceeded.');
        }
        throw new ForbiddenException('Daily free quota exceeded.');
      }

      const supplierId = await this.resolveSupplierId(params.productId, tx);

      await tx.subscriptionDownloadLog.create({
        data: {
          userId: params.userId,
          productId: toBigInt(params.productId),
          supplierId,
          subscriptionId: params.subscriptionId,
          downloadType: params.downloadType,
          dateKey,
        },
      });

      return {
        allowed: true,
        downloadType: params.downloadType,
        reason:
          params.downloadType === SubscriptionDownloadType.SUBSCRIPTION
            ? 'SUBSCRIPTION_LIMIT_OK'
            : 'FREE_LIMIT_OK',
        subscriptionId: params.subscriptionId,
        signedUrl: params.storageKey
          ? this.storage.getDownloadUrl(params.storageKey)
          : null,
        storageKey: params.storageKey,
      };
    });
  }

  private async resolveSupplierId(
    productId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const contributors = await this.productsService.resolveContributors(
      productId,
      tx,
    );

    if (contributors.supplierIds.length === 0) {
      throw new BadRequestException('Product supplier not found.');
    }

    const supplierId = contributors.supplierIds[0];
    if (!supplierId) {
      throw new BadRequestException('Product supplier not found.');
    }

    return supplierId;
  }

  private buildPurchaseDecision(
    storageKey: string | null,
  ): SubscriptionDownloadDecisionDto {
    return {
      allowed: true,
      downloadType: SubscriptionDownloadType.PURCHASED,
      reason: 'PURCHASED',
      subscriptionId: null,
      signedUrl: storageKey ? this.storage.getDownloadUrl(storageKey) : null,
      storageKey,
    };
  }
}
