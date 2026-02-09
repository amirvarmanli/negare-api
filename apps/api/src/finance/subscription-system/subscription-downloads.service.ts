import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { ProductsService } from '@app/finance/products/products.service';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';
import { UserSubscriptionsService } from '@app/finance/subscription-system/user-subscriptions.service';
import { StorageService } from '@app/catalog/storage/storage.service';
import { ProductPricingType } from '@app/finance/common/finance.enums';
import { getTehranDayBounds } from '@app/finance/common/date.utils';
import { BASE_FREE_DAILY_LIMIT } from '@app/finance/common/finance.constants';
import { SubscriptionDownloadType } from '@app/finance/subscription-system/subscription-system.enums';
import type { SubscriptionDownloadDecisionDto } from '@app/finance/subscription-system/dto/subscription-download-decision.dto';

@Injectable()
export class SubscriptionDownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly subscriptionsService: UserSubscriptionsService,
    private readonly storage: StorageService,
  ) {}

  private readonly logger = new Logger(SubscriptionDownloadsService.name);

  async validateDownload(
    userId: string,
    productId: string,
  ): Promise<SubscriptionDownloadDecisionDto> {
    const product = await this.productsService.findProductOrThrow(productId);
    const storageKey = await this.productsService.getProductStorageKey(productId);
    if (!storageKey) {
      throw new NotFoundException('File not found.');
    }
    const hasEntitlement = await this.entitlementsService.hasPurchased(
      userId,
      productId,
    );
    if (hasEntitlement) {
      return this.buildPurchaseDecision(storageKey);
    }
    const subscription = await this.subscriptionsService.getActiveSubscription(userId);

    if (product.pricingType === ProductPricingType.PAID) {
      throw new ForbiddenException({
        code: 'PURCHASE_REQUIRED',
        message: 'PURCHASE_REQUIRED',
      });
    }

    if (product.pricingType === ProductPricingType.PAID_OR_SUBSCRIPTION) {
      if (!subscription) {
        throw new ForbiddenException({
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'SUBSCRIPTION_REQUIRED',
        });
      }
      const plan = await this.subscriptionsService.getPlanById(subscription.planId);
      await this.assertQuota({
        userId,
        subscriptionId: subscription.id,
        planId: plan.id,
        limit: plan.dailyDownloadLimit,
        downloadType: SubscriptionDownloadType.SUBSCRIPTION,
      });
      return this.buildDecision({
        downloadType: SubscriptionDownloadType.SUBSCRIPTION,
        subscriptionId: subscription.id,
        storageKey,
      });
    }

    if (product.pricingType === ProductPricingType.FREE) {
      const limit = subscription
        ? (await this.subscriptionsService.getPlanById(subscription.planId))
            .dailyFreeDownloadLimitWithSubscription
        : BASE_FREE_DAILY_LIMIT;

      await this.assertQuota({
        userId,
        subscriptionId: subscription?.id ?? null,
        planId: subscription?.planId ?? null,
        limit,
        downloadType: SubscriptionDownloadType.FREE,
      });

      return this.buildDecision({
        downloadType: SubscriptionDownloadType.FREE,
        subscriptionId: null,
        storageKey,
      });
    }

    throw new BadRequestException('Unsupported product type.');
  }

  private async assertQuota(params: {
    userId: string;
    subscriptionId: string | null;
    planId: string | null;
    downloadType: SubscriptionDownloadType;
    limit: number;
  }): Promise<void> {
    const { dateKey, start, end } = getTehranDayBounds();

    const used =
      params.downloadType === SubscriptionDownloadType.SUBSCRIPTION
        ? (
            await this.prisma.subscriptionDailyQuotaUsage.findUnique({
              where: { userId_dateKey: { userId: params.userId, dateKey } },
              select: { downloadsUsed: true },
            })
          )?.downloadsUsed ?? 0
        : (
            await this.prisma.financeDownloadUsageDaily.findUnique({
              where: { userId_dateKey: { userId: params.userId, dateKey } },
              select: { usedFree: true },
            })
          )?.usedFree ?? 0;

    this.logger.debug(
      `quota_check user=${params.userId} subscription=${params.subscriptionId ?? 'none'} plan=${params.planId ?? 'none'} limit=${params.limit} used=${used} tz=Asia/Tehran dateKey=${dateKey} start=${start.toISOString()} end=${end.toISOString()}`,
    );

    if (used >= params.limit) {
      throw new HttpException(
        {
          code: 'DAILY_QUOTA_EXCEEDED',
          message: 'DAILY_QUOTA_EXCEEDED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private buildPurchaseDecision(storageKey: string | null): SubscriptionDownloadDecisionDto {
    return {
      allowed: true,
      downloadType: SubscriptionDownloadType.PURCHASED,
      reason: 'PURCHASED',
      subscriptionId: null,
      signedUrl: null,
      storageKey,
    };
  }

  private buildDecision(params: {
    downloadType: SubscriptionDownloadType;
    subscriptionId: string | null;
    storageKey: string | null;
  }): SubscriptionDownloadDecisionDto {
    return {
      allowed: true,
      downloadType: params.downloadType,
      reason:
        params.downloadType === SubscriptionDownloadType.SUBSCRIPTION
          ? 'SUBSCRIPTION_LIMIT_OK'
          : 'FREE_LIMIT_OK',
      subscriptionId: params.subscriptionId,
      signedUrl: null,
      storageKey: params.storageKey,
    };
  }
}
