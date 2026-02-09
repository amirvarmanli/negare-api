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
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import {
  EntitlementSource,
  OrderStatus,
  ProductPricingType,
  SubscriptionStatus,
} from '@app/finance/common/finance.enums';
import { BASE_FREE_DAILY_LIMIT } from '@app/finance/common/finance.constants';
import { getTehranDateKey, getTehranDayBounds } from '@app/finance/common/date.utils';
import type {
  DownloadDecisionDto,
  DownloadLimitsSummaryDto,
  QuotaStatusDto,
} from '@app/finance/downloads/dto/download-response.dto';
import { toBigInt } from '@app/finance/common/prisma.utils';
import { StorageService } from '@app/catalog/storage/storage.service';
import { Readable } from 'node:stream';
import { Prisma, SubscriptionDownloadStatus } from '@prisma/client';
import type { FinanceEntitlementSource } from '@prisma/client';
import { resolveDownloadFilename } from '@app/finance/downloads/downloads.utils';

type DownloadRequestMetadata = {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

@Injectable()
export class DownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly storage: StorageService,
  ) {}

  private readonly logger = new Logger(DownloadsService.name);

  async getDownloadLimitsSummary(userId: string): Promise<DownloadLimitsSummaryDto> {
    const dateKey = getTehranDateKey();
    const freeUsage = await this.prisma.financeDownloadUsageDaily.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
      select: { usedFree: true },
    });

    const usedFree = freeUsage?.usedFree ?? 0;
    let freeLimit = BASE_FREE_DAILY_LIMIT;
    let usedSub = 0;
    let subLimit = 0;
    let hasActiveSubscription = false;
    let subscriptionStatus: SubscriptionStatus | 'NONE' = 'NONE';
    let subscriptionPlan: DownloadLimitsSummaryDto['subscriptionPlan'] = null;

    const subscription = await this.subscriptionsService.getActiveSubscription(
      userId,
    );

    if (subscription) {
      hasActiveSubscription = true;
      subscriptionStatus = SubscriptionStatus.ACTIVE;
      try {
        const plan = await this.subscriptionsService.getPlanById(
          subscription.planId,
        );
        freeLimit =
          plan.dailyFreeDownloadLimitWithSubscription ?? BASE_FREE_DAILY_LIMIT;

        const subUsage = await this.prisma.subscriptionDailyQuotaUsage.findUnique(
          {
            where: { userId_dateKey: { userId, dateKey } },
            select: { downloadsUsed: true, downloadsLimitSnapshot: true },
          },
        );

        usedSub = subUsage?.downloadsUsed ?? 0;
        subLimit = subUsage?.downloadsLimitSnapshot ?? plan.dailyDownloadLimit ?? 0;
        subscriptionPlan = {
          id: plan.id,
          title: plan.title,
          expiresAt: subscription.endAt.toISOString(),
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown_error';
        this.logger.warn(
          `subscription_limits_inconsistent user=${userId} reason=${message}`,
        );
        return {
          freeDownloads: { used: 0, limit: 0, remaining: 0 },
          subscriptionDownloads: { used: 0, limit: 0, remaining: 0 },
          hasActiveSubscription: true,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionPlan: {
            id: subscription.planId,
            title: subscription.planTitle,
            expiresAt: subscription.endAt.toISOString(),
          },
          warning: 'SUBSCRIPTION_DATA_INCONSISTENT',
        };
      }
    } else {
      const latest = await this.subscriptionsService.getLatestSubscription(userId);
      if (latest) {
        const now = new Date();
        let status = latest.status as SubscriptionStatus;
        if (status === SubscriptionStatus.ACTIVE && latest.endAt < now) {
          status = SubscriptionStatus.EXPIRED;
        }
        subscriptionStatus = status;
        subscriptionPlan = {
          id: latest.planId,
          title: latest.planTitle,
          expiresAt: latest.endAt.toISOString(),
        };
      }
    }

    const freeRemaining = Math.max(0, freeLimit - usedFree);
    const subRemaining = Math.max(0, subLimit - usedSub);

    return {
      freeDownloads: {
        used: usedFree,
        limit: freeLimit,
        remaining: freeRemaining,
      },
      subscriptionDownloads: {
        used: usedSub,
        limit: subLimit,
        remaining: subRemaining,
      },
      hasActiveSubscription,
      subscriptionStatus,
      subscriptionPlan,
    };
  }

  async getTodayQuota(userId: string): Promise<QuotaStatusDto> {
    const dateKey = getTehranDateKey();
    const subscription = await this.subscriptionsService.getActiveSubscription(
      userId,
    );
    const freeUsage = await this.prisma.financeDownloadUsageDaily.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
    });

    const usedFree = freeUsage?.usedFree ?? 0;

    if (!subscription) {
      return {
        usedFree,
        freeLimit: BASE_FREE_DAILY_LIMIT,
        usedSub: 0,
        subLimit: 0,
        hasSubscription: false,
      };
    }

    const plan = await this.subscriptionsService.getPlanById(
      subscription.planId,
    );
    const subUsage = await this.prisma.subscriptionDailyQuotaUsage.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
    });

    const usedSub = subUsage?.downloadsUsed ?? 0;
    const subLimit =
      subUsage?.downloadsLimitSnapshot ?? plan.dailyDownloadLimit;

    return {
      usedFree,
      freeLimit: plan.dailyFreeDownloadLimitWithSubscription,
      usedSub,
      subLimit,
      hasSubscription: true,
    };
  }

  async downloadProduct(
    userId: string,
    productId: string,
    metadata: DownloadRequestMetadata = {},
  ): Promise<DownloadDecisionDto> {
    const product = await this.productsService.findProductOrThrow(productId);
    const storageKey = await this.productsService.getProductStorageKey(productId);
    const isFree = this.isFreeProduct(product);
    const isSubscriptionProduct = await this.isSubscriptionProduct(
      productId,
      product.pricingType,
    );

    const hasEntitlement = await this.entitlementsService.hasPurchased(
      userId,
      productId,
    );

    if (hasEntitlement && !isFree) {
      const signedUrl = this.requireSignedUrl(storageKey);
      const dateKey = getTehranDateKey();
      await this.prisma.financeDownloadLog.create({
        data: {
          userId,
          productId: toBigInt(productId),
          dateKey,
          source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
          subscriptionId: null,
          orderId: null,
        },
      });
      if (isSubscriptionProduct) {
        await this.logSubscriptionDownloadAttempt({
          userId,
          productId,
          subscriptionId: null,
          downloadType: 'PURCHASED',
          status: SubscriptionDownloadStatus.SUCCESS,
          isSubscriptionDownload: false,
          failReason: null,
          metadata,
        });
      }
      await this.logDownloadEvent({
        userId,
        productId,
        isFree,
        metadata,
      });
      return {
        allowed: true,
        source: EntitlementSource.PURCHASED,
        reason: 'PURCHASED',
        productType: product.pricingType,
        signedUrl,
        storageKey,
      };
    }

    if (isFree) {
      this.requireSignedUrl(storageKey);
      const subscription = await this.subscriptionsService.getActiveSubscription(
        userId,
      );
      const plan = subscription
        ? await this.subscriptionsService.getPlanById(subscription.planId)
        : null;
      const limit = subscription
        ? plan?.dailyFreeDownloadLimitWithSubscription ?? BASE_FREE_DAILY_LIMIT
        : BASE_FREE_DAILY_LIMIT;

      return this.consumeFreeQuota({
        userId,
        productId,
        limit,
        source: EntitlementSource.FREE_QUOTA,
        subscriptionId: subscription ? subscription.id : null,
        productType: product.pricingType,
        storageKey,
        isFree: true,
        metadata,
      });
    }

    if (isSubscriptionProduct) {
      return this.downloadSubscriptionProduct({
        userId,
        productId,
        storageKey,
        metadata,
        productType: product.pricingType,
      });
    }

    if (product.pricingType === ProductPricingType.PAID) {
      throw new ForbiddenException('برای دانلود نیاز به خرید محصول است.');
    }

    if (product.pricingType === ProductPricingType.PAID_OR_SUBSCRIPTION) {
      return this.downloadSubscriptionProduct({
        userId,
        productId,
        storageKey,
        metadata,
        productType: product.pricingType,
      });
    }

    throw new BadRequestException('Unsupported product type.');
  }

  async downloadFile(
    userId: string,
    fileId: string,
    metadata: DownloadRequestMetadata = {},
  ): Promise<DownloadDecisionDto> {
    const file = await this.prisma.productFile.findUnique({
      where: { id: toBigInt(fileId) },
      select: { productId: true },
    });
    if (!file) {
      throw new NotFoundException('File not found.');
    }
    return this.downloadProduct(userId, file.productId.toString(), metadata);
  }

  async downloadProductStream(
    userId: string,
    productId: string,
    metadata: DownloadRequestMetadata = {},
  ): Promise<{
    stream: Readable;
    filename: string;
    mimeType?: string;
    size?: number;
  }> {
    const file = await this.prisma.productFile.findUnique({
      where: { productId: toBigInt(productId) },
      select: {
        id: true,
        storageKey: true,
        originalName: true,
        mimeType: true,
        size: true,
        sourceFile: { select: { filename: true, mime: true, size: true } },
      },
    });
    if (!file || !file.storageKey) {
      await this.logDownloadAttempt({
        userId,
        subscriptionId: null,
        fileId: `product-${productId}`,
        mimeType: null,
        size: null,
      });
      throw new NotFoundException('File not found.');
    }

    const resolvedMime = file.mimeType ?? file.sourceFile?.mime ?? null;
    const resolvedSize = file.size ?? file.sourceFile?.size ?? null;
    const subscriptionId = await this.resolveSubscriptionId(userId);
    await this.logDownloadAttempt({
      userId,
      subscriptionId,
      fileId: file.id.toString(),
      mimeType: resolvedMime,
      size: this.normalizeLogSize(resolvedSize),
    });

    await this.downloadProduct(userId, productId, metadata);

    const filename = resolveDownloadFilename({
      originalName: file.originalName ?? file.sourceFile?.filename ?? null,
      fileId: file.id.toString(),
      mimeType: resolvedMime,
    });
    return {
      stream: this.storage.getDownloadStream(file.storageKey),
      filename,
      mimeType: resolvedMime ?? 'application/octet-stream',
      size:
        resolvedSize !== null && resolvedSize !== undefined
          ? Number(resolvedSize)
          : undefined,
    };
  }

  async downloadFileStream(
    userId: string,
    fileId: string,
    metadata: DownloadRequestMetadata = {},
  ): Promise<{
    stream: Readable;
    filename: string;
    mimeType?: string;
    size?: number;
  }> {
    const file = await this.prisma.productFile.findUnique({
      where: { id: toBigInt(fileId) },
      select: {
        id: true,
        storageKey: true,
        productId: true,
        originalName: true,
        mimeType: true,
        size: true,
        sourceFile: { select: { filename: true, mime: true, size: true } },
      },
    });
    if (!file || !file.storageKey) {
      await this.logDownloadAttempt({
        userId,
        subscriptionId: null,
        fileId,
        mimeType: null,
        size: null,
      });
      throw new NotFoundException('File not found.');
    }

    const resolvedMime = file.mimeType ?? file.sourceFile?.mime ?? null;
    const resolvedSize = file.size ?? file.sourceFile?.size ?? null;
    const subscriptionId = await this.resolveSubscriptionId(userId);
    await this.logDownloadAttempt({
      userId,
      subscriptionId,
      fileId: file.id.toString(),
      mimeType: resolvedMime,
      size: this.normalizeLogSize(resolvedSize),
    });

    await this.downloadProduct(userId, file.productId.toString(), metadata);

    const filename = resolveDownloadFilename({
      originalName: file.originalName ?? file.sourceFile?.filename ?? null,
      fileId: file.id.toString(),
      mimeType: resolvedMime,
    });

    return {
      stream: this.storage.getDownloadStream(file.storageKey),
      filename,
      mimeType: resolvedMime ?? 'application/octet-stream',
      size:
        resolvedSize !== null && resolvedSize !== undefined
          ? Number(resolvedSize)
          : undefined,
    };
  }

  private async downloadSubscriptionProduct(params: {
    userId: string;
    productId: string;
    storageKey: string | null;
    metadata: DownloadRequestMetadata;
    productType: ProductPricingType;
  }): Promise<DownloadDecisionDto> {
    const subscription = await this.subscriptionsService.getActiveSubscription(
      params.userId,
    );

    if (!subscription) {
      await this.logSubscriptionDownloadAttempt({
        userId: params.userId,
        productId: params.productId,
        subscriptionId: null,
        downloadType: 'SUBSCRIPTION',
        status: SubscriptionDownloadStatus.FAILED,
        isSubscriptionDownload: true,
        failReason: 'SUBSCRIPTION_REQUIRED',
        metadata: params.metadata,
      });
      this.logger.debug(
        `subscription_required user=${params.userId} product=${params.productId}`,
      );
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'SUBSCRIPTION_REQUIRED',
      });
    }

    const plan = await this.subscriptionsService.getPlanById(
      subscription.planId,
    );
    this.logger.debug(
      `subscription_ok user=${params.userId} subscription=${subscription.id} plan=${plan.id}`,
    );

    try {
      this.requireSignedUrl(params.storageKey);
    } catch (err) {
      await this.logSubscriptionDownloadAttempt({
        userId: params.userId,
        productId: params.productId,
        subscriptionId: subscription.id,
        downloadType: 'SUBSCRIPTION',
        status: SubscriptionDownloadStatus.FAILED,
        isSubscriptionDownload: true,
        failReason: 'FILE_NOT_FOUND',
        metadata: params.metadata,
      });
      throw err;
    }

    const dateKey = getTehranDateKey();
    const supplierId = await this.resolveSupplierId(params.productId);
    await this.assertSubscriptionDownloadFks({
      userId: params.userId,
      productId: params.productId,
      subscriptionId: subscription.id,
      supplierId,
    });

    const quota = await this.consumeSubscriptionQuota({
      userId: params.userId,
      productId: params.productId,
      subscriptionId: subscription.id,
      planId: plan.id,
      limit: plan.dailyDownloadLimit,
    });

    if (!quota.allowed) {
      await this.logSubscriptionDownloadAttempt({
        userId: params.userId,
        productId: params.productId,
        subscriptionId: subscription.id,
        downloadType: 'SUBSCRIPTION',
        status: SubscriptionDownloadStatus.FAILED,
        isSubscriptionDownload: true,
        failReason: 'DAILY_QUOTA_EXCEEDED',
        metadata: params.metadata,
      });
      this.logger.debug(
        `quota_exceeded user=${params.userId} subscription=${subscription.id} plan=${plan.id} date=${dateKey} used=${quota.used} limit=${quota.limit} tz=Asia/Tehran`,
      );
      throw new HttpException(
        {
          code: 'DAILY_QUOTA_EXCEEDED',
          message: 'DAILY_QUOTA_EXCEEDED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.debug(
      `download_allowed user=${params.userId} subscription=${subscription.id} plan=${plan.id} date=${dateKey} used=${quota.used} limit=${quota.limit} tz=Asia/Tehran`,
    );

    await this.prisma.financeDownloadLog.create({
      data: {
        userId: params.userId,
        productId: toBigInt(params.productId),
        dateKey,
        source: EntitlementSource.SUB_QUOTA as FinanceEntitlementSource,
        subscriptionId: subscription.id,
        orderId: null,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      this.logger.debug(
        `tx_before subscriptionDownloadLog.create user=${params.userId} subscription=${subscription.id} plan=${plan.id} dateKey=${dateKey} tz=Asia/Tehran`,
      );
      await this.createSubscriptionDownloadLog(tx, {
        userId: params.userId,
        productId: params.productId,
        subscriptionId: subscription.id,
        supplierId,
        downloadType: 'SUBSCRIPTION',
        status: SubscriptionDownloadStatus.SUCCESS,
        isSubscriptionDownload: true,
        failReason: null,
        metadata: params.metadata,
        dateKey,
      });
      this.logger.debug(
        `tx_after subscriptionDownloadLog.create user=${params.userId} subscription=${subscription.id} plan=${plan.id} dateKey=${dateKey} tz=Asia/Tehran`,
      );

      this.logger.debug(
        `tx_before downloadEvent.create user=${params.userId} subscription=${subscription.id} plan=${plan.id} dateKey=${dateKey} tz=Asia/Tehran`,
      );
      await this.createDownloadEvent(tx, {
        userId: params.userId,
        productId: params.productId,
        isFree: false,
        metadata: params.metadata,
      });
      this.logger.debug(
        `tx_after downloadEvent.create user=${params.userId} subscription=${subscription.id} plan=${plan.id} dateKey=${dateKey} tz=Asia/Tehran`,
      );
    });

    return {
      allowed: true,
      source: EntitlementSource.SUB_QUOTA,
      reason: 'SUBSCRIPTION_QUOTA_OK',
      productType: params.productType,
      signedUrl: params.storageKey
        ? this.storage.getDownloadUrl(params.storageKey)
        : null,
      storageKey: params.storageKey,
    };
  }

  private async consumeSubscriptionQuota(params: {
    userId: string;
    productId: string;
    subscriptionId: string;
    planId: string;
    limit: number;
  }): Promise<{ allowed: boolean; used: number; limit: number }> {
    const { dateKey, start, end } = getTehranDayBounds();

    const result = await this.prisma.$transaction(async (tx) => {
      this.logger.debug(
        `tx_before dailyUnique.find user=${params.userId} subscription=${params.subscriptionId} plan=${params.planId} dateKey=${dateKey} tz=Asia/Tehran`,
      );
      const existing = await tx.financeDownloadDailyUnique.findUnique({
        where: {
          userId_productId_dateKey: {
            userId: params.userId,
            productId: toBigInt(params.productId),
            dateKey,
          },
        },
        select: { id: true },
      });
      this.logger.debug(
        `tx_after dailyUnique.find user=${params.userId} subscription=${params.subscriptionId} plan=${params.planId} dateKey=${dateKey} exists=${!!existing} tz=Asia/Tehran`,
      );

      if (existing) {
        const usage = await tx.subscriptionDailyQuotaUsage.findUnique({
          where: { userId_dateKey: { userId: params.userId, dateKey } },
          select: { downloadsUsed: true, downloadsLimitSnapshot: true },
        });
        const used = usage?.downloadsUsed ?? 0;
        const limit = usage?.downloadsLimitSnapshot ?? params.limit;
        return { allowed: true, used, limit };
      }

      const alreadyDownloaded = false;

      this.logger.debug(
        `tx_before subscriptionDailyQuotaUsage.upsert user=${params.userId} subscription=${params.subscriptionId} plan=${params.planId} dateKey=${dateKey} tz=Asia/Tehran`,
      );
      const usage = await tx.subscriptionDailyQuotaUsage.upsert({
        where: { userId_dateKey: { userId: params.userId, dateKey } },
        create: {
          userId: params.userId,
          dateKey,
          downloadsUsed: 0,
          downloadsLimitSnapshot: params.limit,
        },
        update: {},
      });
      this.logger.debug(
        `tx_after subscriptionDailyQuotaUsage.upsert user=${params.userId} subscription=${params.subscriptionId} plan=${params.planId} dateKey=${dateKey} used=${usage.downloadsUsed} limit=${usage.downloadsLimitSnapshot} tz=Asia/Tehran`,
      );

      let incremented = false;
      if (!alreadyDownloaded) {
        this.logger.debug(
          `tx_before subscriptionDailyQuotaUsage.updateMany user=${params.userId} subscription=${params.subscriptionId} plan=${params.planId} dateKey=${dateKey} tz=Asia/Tehran`,
        );
        const updated = await tx.subscriptionDailyQuotaUsage.updateMany({
          where: {
            userId: params.userId,
            dateKey,
            downloadsUsed: { lt: usage.downloadsLimitSnapshot },
          },
          data: { downloadsUsed: { increment: 1 } },
        });
        incremented = updated.count > 0;
        this.logger.debug(
          `tx_after subscriptionDailyQuotaUsage.updateMany user=${params.userId} subscription=${params.subscriptionId} plan=${params.planId} dateKey=${dateKey} incremented=${incremented} tz=Asia/Tehran`,
        );
      }

      if (incremented) {
        this.logger.debug(
          `tx_before dailyUnique.create user=${params.userId} subscription=${params.subscriptionId} plan=${params.planId} dateKey=${dateKey} tz=Asia/Tehran`,
        );
        const created = await tx.financeDownloadDailyUnique.createMany({
          data: [
            {
              userId: params.userId,
              productId: toBigInt(params.productId),
              dateKey,
            },
          ],
          skipDuplicates: true,
        });
        this.logger.debug(
          `tx_after dailyUnique.create user=${params.userId} subscription=${params.subscriptionId} plan=${params.planId} dateKey=${dateKey} created=${created.count} tz=Asia/Tehran`,
        );
        if (created.count === 0) {
          await tx.subscriptionDailyQuotaUsage.updateMany({
            where: {
              userId: params.userId,
              dateKey,
              downloadsUsed: { gt: 0 },
            },
            data: { downloadsUsed: { decrement: 1 } },
          });
          return {
            allowed: true,
            used: usage.downloadsUsed,
            limit: usage.downloadsLimitSnapshot,
          };
        }
      }

      this.logger.debug(
        `quota_check user=${params.userId} subscription=${params.subscriptionId} plan=${params.planId} limit=${params.limit} used=${usage.downloadsUsed} tz=Asia/Tehran dateKey=${dateKey} start=${start.toISOString()} end=${end.toISOString()}`,
      );

      const usedAfter = alreadyDownloaded
        ? usage.downloadsUsed
        : usage.downloadsUsed + (incremented ? 1 : 0);
      const allowed = alreadyDownloaded || incremented;

      return {
        allowed,
        used: usedAfter,
        limit: usage.downloadsLimitSnapshot,
      };
    });

    return result;
  }

  private async assertSubscriptionDownloadFks(params: {
    userId: string;
    productId: string;
    subscriptionId: string;
    supplierId: string;
  }): Promise<void> {
    const [user, product, subscription, supplier] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { id: true },
      }),
      this.prisma.product.findUnique({
        where: { id: toBigInt(params.productId) },
        select: { id: true },
      }),
      this.prisma.subscription.findUnique({
        where: { id: params.subscriptionId },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id: params.supplierId },
        select: { id: true },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found.');
    }
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }
    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }
  }

  private async consumeFreeQuota(params: {
    userId: string;
    productId: string;
    limit: number;
    source: EntitlementSource;
    subscriptionId: string | null;
    productType: ProductPricingType;
    storageKey: string | null;
    isFree: boolean;
    metadata?: DownloadRequestMetadata;
  }): Promise<DownloadDecisionDto> {
    const dateKey = getTehranDateKey();

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const alreadyDownloaded = await this.registerDailyDownload(
        tx,
        params.userId,
        params.productId,
        dateKey,
      );
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

      if (!alreadyDownloaded) {
        const result = await tx.financeDownloadUsageDaily.updateMany({
          where: {
            userId: params.userId,
            dateKey,
            usedFree: { lt: params.limit },
          },
          data: { usedFree: { increment: 1 } },
        });
        if (result.count === 0) {
          throw new HttpException(
            {
              code: 'DAILY_QUOTA_EXCEEDED',
              message: 'سقف دانلود روزانه محصولات رایگان به پایان رسیده است.',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
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

      await this.createDownloadEvent(tx, {
        userId: params.userId,
        productId: params.productId,
        isFree: params.isFree,
        metadata: params.metadata,
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
    metadata?: DownloadRequestMetadata;
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
        mimeType: true,
        size: true,
        product: {
          select: {
            pricingType: true,
            price: true,
          },
        },
        sourceFile: { select: { filename: true, mime: true, size: true } },
      },
    });
    if (!file) {
      await this.logDownloadAttempt({
        userId: params.userId,
        subscriptionId: null,
        fileId: params.fileId,
        mimeType: null,
        size: null,
      });
      throw new NotFoundException('File not found.');
    }

    const resolvedMime = file.mimeType ?? file.sourceFile?.mime ?? null;
    const resolvedSize = file.size ?? file.sourceFile?.size ?? null;
    await this.logDownloadAttempt({
      userId: params.userId,
      subscriptionId: null,
      fileId: file.id.toString(),
      mimeType: resolvedMime,
      size: this.normalizeLogSize(resolvedSize),
    });

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

    await this.logDownloadEvent({
      userId: params.userId,
      productId: file.productId.toString(),
      isFree: this.isFreeProduct({
        pricingType: file.product.pricingType as ProductPricingType,
        price: file.product.price ? Number(file.product.price) : null,
      }),
      metadata: params.metadata,
    });

    const filename = resolveDownloadFilename({
      originalName: file.originalName ?? file.sourceFile?.filename ?? null,
      fileId: file.id.toString(),
      mimeType: resolvedMime,
    });

    return {
      stream: this.storage.getDownloadStream(file.storageKey),
      filename,
      mimeType: resolvedMime ?? 'application/octet-stream',
      size:
        resolvedSize !== null && resolvedSize !== undefined
          ? Number(resolvedSize)
          : undefined,
    };
  }

  private isFreeProduct(product: {
    pricingType: ProductPricingType;
    price: number | null;
  }): boolean {
    return (
      product.pricingType === ProductPricingType.FREE ||
      (product.price !== null && product.price <= 0)
    );
  }

  private async createDownloadEvent(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      productId: string;
      isFree: boolean;
      metadata?: DownloadRequestMetadata;
    },
  ): Promise<void> {
    await tx.downloadEvent.create({
      data: {
        userId: params.userId,
        productId: toBigInt(params.productId),
        isFree: params.isFree,
        ip: params.metadata?.ip ?? null,
        userAgent: params.metadata?.userAgent ?? null,
        requestId: params.metadata?.requestId ?? null,
      },
    });
  }

  private async logDownloadEvent(params: {
    userId: string;
    productId: string;
    isFree: boolean;
    metadata?: DownloadRequestMetadata;
  }): Promise<void> {
    await this.prisma.downloadEvent.create({
      data: {
        userId: params.userId,
        productId: toBigInt(params.productId),
        isFree: params.isFree,
        ip: params.metadata?.ip ?? null,
        userAgent: params.metadata?.userAgent ?? null,
        requestId: params.metadata?.requestId ?? null,
      },
    });
  }

  private async createSubscriptionDownloadLog(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      productId: string;
      subscriptionId: string | null;
      supplierId?: string;
      downloadType: 'SUBSCRIPTION' | 'PURCHASED' | 'FREE';
      status: SubscriptionDownloadStatus;
      isSubscriptionDownload: boolean;
      failReason: string | null;
      metadata?: DownloadRequestMetadata;
      dateKey: string;
    },
  ): Promise<void> {
    const supplierId =
      params.supplierId ?? (await this.resolveSupplierId(params.productId, tx));

    await tx.subscriptionDownloadLog.create({
      data: {
        userId: params.userId,
        productId: toBigInt(params.productId),
        supplierId,
        downloadType: params.downloadType,
        subscriptionId: params.subscriptionId,
        dateKey: params.dateKey,
        isSubscriptionDownload: params.isSubscriptionDownload,
        status: params.status,
        failReason: params.failReason,
        ip: params.metadata?.ip ?? null,
        userAgent: params.metadata?.userAgent ?? null,
      },
    });
  }

  private async logSubscriptionDownloadAttempt(params: {
    userId: string;
    productId: string;
    subscriptionId: string | null;
    downloadType: 'SUBSCRIPTION' | 'PURCHASED' | 'FREE';
    status: SubscriptionDownloadStatus;
    isSubscriptionDownload: boolean;
    failReason: string | null;
    metadata?: DownloadRequestMetadata;
  }): Promise<void> {
    try {
      const dateKey = getTehranDateKey();
      const supplierId = await this.resolveSupplierId(params.productId);

      await this.prisma.subscriptionDownloadLog.create({
        data: {
          userId: params.userId,
          productId: toBigInt(params.productId),
          supplierId,
          downloadType: params.downloadType,
          subscriptionId: params.subscriptionId,
          dateKey,
          isSubscriptionDownload: params.isSubscriptionDownload,
          status: params.status,
          failReason: params.failReason,
          ip: params.metadata?.ip ?? null,
          userAgent: params.metadata?.userAgent ?? null,
        },
      });
    } catch {
      // Best-effort logging; do not block the main download flow.
    }
  }

  private async resolveSupplierId(
    productId: string,
    tx: Prisma.TransactionClient = this.prisma,
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

  private async isSubscriptionProduct(
    productId: string,
    pricingType: ProductPricingType,
  ): Promise<boolean> {
    return pricingType === ProductPricingType.PAID_OR_SUBSCRIPTION;
  }

  private requireSignedUrl(storageKey: string | null): string {
    if (!storageKey) {
      throw new ForbiddenException({
        code: 'FILE_NOT_FOUND',
        message: 'فایل محصول یافت نشد.',
      });
    }
    return this.storage.getDownloadUrl(storageKey);
  }

  private async registerDailyDownload(
    tx: Prisma.TransactionClient,
    userId: string,
    productId: string,
    dateKey: string,
  ): Promise<boolean> {
    const result = await tx.financeDownloadDailyUnique.createMany({
      data: [
        {
          userId,
          productId: toBigInt(productId),
          dateKey,
        },
      ],
      skipDuplicates: true,
    });
    return result.count === 0;
  }

  private async resolveSubscriptionId(userId: string): Promise<string | null> {
    try {
      const subscription =
        await this.subscriptionsService.getActiveSubscription(userId);
      return subscription?.id ?? null;
    } catch {
      return null;
    }
  }

  private async logDownloadAttempt(params: {
    userId: string;
    subscriptionId: string | null;
    fileId: string;
    mimeType: string | null;
    size: number | string | null;
  }): Promise<void> {
    const dateKey = getTehranDateKey();
    const tz = 'Asia/Tehran';
    this.logger.log(
      `download_attempt user=${params.userId} subscription=${params.subscriptionId ?? 'none'} file=${params.fileId} mime=${params.mimeType ?? 'unknown'} size=${params.size ?? 'unknown'} dateKey=${dateKey} tz=${tz}`,
    );
  }

  private normalizeLogSize(
    size: number | string | bigint | null | undefined,
  ): number | string | null {
    if (size === null || size === undefined) return null;
    if (typeof size === 'bigint') {
      const asNumber = Number(size);
      return Number.isFinite(asNumber) ? asNumber : size.toString();
    }
    return size;
  }
}
