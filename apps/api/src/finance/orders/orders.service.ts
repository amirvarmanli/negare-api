import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { ProductsService } from '@app/finance/products/products.service';
import { DiscountsService } from '@app/finance/discounts/discounts.service';
import { SubscriptionsService } from '@app/finance/subscriptions/subscriptions.service';
import {
  EntitlementSource,
  DiscountType,
  OrderKind,
  OrderStatus,
  ProductPricingType,
} from '@app/finance/common/finance.enums';
import { ORDER_PAYMENT_TTL_MINUTES } from '@app/finance/common/finance.constants';
import type { CreateOrderDto } from '@app/finance/orders/dto/create-order.dto';
import { toBigInt, toBigIntString } from '@app/finance/common/prisma.utils';
import { DownloadTokensService } from '@app/finance/downloads/download-tokens.service';
import type { PurchaseResultDto } from '@app/finance/orders/dto/purchase-result.dto';
import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@app/config/config.module';
import { buildApiBaseUrl } from '@app/finance/common/api-base-url.util';
import type {
  FinanceDiscountType,
  FinanceEntitlement,
  FinanceEntitlementSource,
  FinanceOrder,
  FinanceOrderItem,
  FinanceOrderKind,
  FinanceOrderStatus,
  PricingType,
  Prisma,
} from '@prisma/client';

export type OrderWithItems = FinanceOrder & { items: FinanceOrderItem[] };
export type OrderDetailResult = Prisma.FinanceOrderGetPayload<{
  include: {
    items: {
      select: {
        id: true;
        productId: true;
        unitPriceSnapshot: true;
        quantity: true;
        lineTotal: true;
        product: { select: { title: true } };
      };
    };
    payments: {
      select: {
        id: true;
        provider: true;
        status: true;
        trackId: true;
        authority: true;
        amount: true;
        createdAt: true;
      };
    };
  };
}>;
export type OrderEntitlementResult = Pick<
  FinanceEntitlement,
  'productId' | 'source' | 'createdAt'
>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly discountsService: DiscountsService,
    private readonly downloadTokens: DownloadTokensService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly config: ConfigService<AllConfig>,
  ) {}

  async createProductOrder(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<OrderWithItems> {
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.productsService.findByIds(productIds);

    const alreadyPurchased = await this.prisma.financeEntitlement.findMany({
      where: {
        userId,
        productId: { in: productIds.map(toBigInt) },
        source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
      },
      select: { productId: true },
    });
    if (alreadyPurchased.length > 0) {
      throw new ConflictException('Product already purchased.');
    }

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products were not found.');
    }

    const lineItems = dto.items.map((item) => {
      const product = products.find((prod) => prod.id === item.productId);
      if (!product) {
        throw new NotFoundException('Product not found.');
      }
      if (product.pricingType === ProductPricingType.FREE) {
        throw new BadRequestException('FREE products cannot be purchased.');
      }
      if (!product.price || product.price <= 0) {
        throw new BadRequestException('Product price is not set.');
      }
      const unitPrice = Math.round(product.price);
      const lineTotal = unitPrice * item.quantity;
      return {
        product,
        unitPrice,
        lineTotal,
        quantity: item.quantity,
      };
    });

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const resolvedCoupon = dto.couponCode?.trim() || undefined;

    const savedOrder = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        let quote = await this.discountsService.calculateDiscountQuote(tx, {
          userId,
          orderKind: OrderKind.PRODUCT,
          items: lineItems.map((item) => ({
            productId: item.product.id,
            pricingType: item.product.pricingType,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
          })),
          couponCode: resolvedCoupon,
          subscriptionDiscount: null,
        });

        const subscriptionCandidate = await this.subscriptionsService.getDiscountCandidate(
          userId,
          tx,
        );
        if (
          quote.appliedDiscountSource !== 'COUPON' &&
          quote.discountValue <= 0 &&
          subscriptionCandidate
        ) {
          const subscriptionAmount = Math.min(
            Math.floor((subtotal * subscriptionCandidate.percent) / 100),
            subtotal,
          );
          if (subscriptionAmount > 0) {
            quote = {
              ...quote,
              discountType: DiscountType.PERCENT,
              discountValue: subscriptionAmount,
              appliedDiscountSource: 'SUBSCRIPTION',
              appliedDiscountAmount: subscriptionAmount,
              appliedDiscountPercent: subscriptionCandidate.percent,
              appliedDiscountReason: `Subscription discount applied: ${subscriptionCandidate.percent}% off`,
              subscriptionDiscountPercent: subscriptionCandidate.percent,
              subscriptionDiscountRemaining: subscriptionCandidate.remaining,
              subscriptionDiscountUsed: subscriptionCandidate.used,
              subscriptionDiscountTotal: subscriptionCandidate.total,
            };
          }
        }

        const total = Math.max(0, subtotal - quote.discountValue);

        let order = await tx.financeOrder.create({
          data: {
            userId,
            status: OrderStatus.PENDING_PAYMENT as FinanceOrderStatus,
            orderKind: OrderKind.PRODUCT as FinanceOrderKind,
            subtotal,
            discountType: quote.discountType as FinanceDiscountType,
            discountValue: quote.discountValue,
            discountAmount: quote.discountValue,
            discountSource: quote.appliedDiscountSource,
            couponCode: quote.appliedDiscountCode ?? null,
            discountReason: quote.appliedDiscountReason,
            total,
            currency: 'TOMAN',
            subscriptionPlanId: null,
            subscriptionDurationMonths: null,
            paidAt: null,
            expiresAt: new Date(
              Date.now() + ORDER_PAYMENT_TTL_MINUTES * 60 * 1000,
            ),
          },
        });

        const itemsData = lineItems.map((item) => ({
          orderId: order.id,
          productId: toBigInt(item.product.id),
          unitPriceSnapshot: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          productTypeSnapshot: item.product.pricingType as PricingType,
        }));

        await tx.financeOrderItem.createMany({ data: itemsData });

        if (quote.couponId && quote.discountValue > 0) {
          await this.discountsService.commitCouponRedemption(tx, {
            couponId: quote.couponId,
            userId,
            orderId: order.id,
          });
        }

        if (quote.appliedDiscountSource === 'SUBSCRIPTION') {
          const usage = await this.subscriptionsService.consumeSubscriptionDiscountForOrder(
            tx,
            { userId, orderId: order.id, subtotal },
          );
          if (!usage) {
            order = await tx.financeOrder.update({
              where: { id: order.id },
              data: {
                discountType: DiscountType.NONE,
                discountValue: 0,
                discountAmount: 0,
                discountSource: 'NONE',
                discountReason: 'No discount applied.',
                total: subtotal,
              },
            });
          }
        }

        return order;
      },
    );

    return this.findOrderWithItems(savedOrder.id);
  }

  async findOrderWithItems(orderId: string): Promise<OrderWithItems> {
    const order = await this.prisma.financeOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    return order;
  }

  async findOrderForUser(
    orderId: string,
    userId: string,
  ): Promise<OrderWithItems> {
    const order = await this.prisma.financeOrder.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    return order;
  }

  async getByIdForUser(
    orderId: string,
    userId: string,
  ): Promise<{
    order: OrderDetailResult;
    entitlements: OrderEntitlementResult[];
  }> {
    const order = await this.prisma.financeOrder.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            unitPriceSnapshot: true,
            quantity: true,
            lineTotal: true,
            product: { select: { title: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            provider: true,
            status: true,
            trackId: true,
            authority: true,
            amount: true,
            createdAt: true,
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    const entitlements = await this.prisma.financeEntitlement.findMany({
      where: { orderId, userId },
      select: {
        productId: true,
        source: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { order, entitlements };
  }

  async getPurchaseResult(
    orderId: string,
    userId: string,
  ): Promise<PurchaseResultDto> {
    const order = await this.prisma.financeOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        total: true,
        paidAt: true,
        items: {
          select: {
            productId: true,
            product: {
              select: {
                id: true,
                title: true,
                coverUrl: true,
                pricingType: true,
              },
            },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }
    if (order.items.length === 0) {
      return {
        orderId: order.id,
        status: this.mapPurchaseStatus(order.status as OrderStatus),
        paidAt: order.paidAt ? order.paidAt.toISOString() : undefined,
        totalAmount: order.total,
        items: [],
      };
    }

    const status = this.mapPurchaseStatus(order.status as OrderStatus);
    const includeDownloads = status === 'SUCCESS';

    const productIds = order.items.map((item) => item.productId);
    const files = includeDownloads
      ? await this.prisma.productFile.findMany({
          where: { productId: { in: productIds } },
          select: {
            id: true,
            productId: true,
            originalName: true,
            mimeType: true,
            size: true,
            sourceFile: { select: { filename: true, mime: true, size: true } },
          },
        })
      : [];

    const filesByProductId = new Map<string, typeof files>();
    for (const file of files) {
      const key = toBigIntString(file.productId);
      const list = filesByProductId.get(key);
      if (list) {
        list.push(file);
      } else {
        filesByProductId.set(key, [file]);
      }
    }

    const apiBaseUrl = buildApiBaseUrl(this.config);

    return {
      orderId: order.id,
      status,
      paidAt: order.paidAt ? order.paidAt.toISOString() : undefined,
      totalAmount: order.total,
      items: order.items.map((item) => {
        const product = item.product;
        const downloads: PurchaseResultDto['items'][number]['downloads'] =
          includeDownloads
            ? (filesByProductId.get(toBigIntString(product.id)) ?? []).map(
                (file) => {
                  const fileId = toBigIntString(file.id);
                  const token = this.downloadTokens.signDownloadToken({
                    userId,
                    orderId: order.id,
                    fileId,
                  });
                  const url = new URL(
                    `downloads/files/${fileId}?token=${encodeURIComponent(
                      token.token,
                    )}`,
                    apiBaseUrl,
                  ).toString();
                  const sizeBytes =
                    file.size !== null && file.size !== undefined
                      ? Number(file.size)
                      : file.sourceFile?.size !== null &&
                          file.sourceFile?.size !== undefined
                        ? Number(file.sourceFile.size)
                        : undefined;

                  return {
                    fileId,
                    filename:
                      file.originalName ??
                      file.sourceFile?.filename ??
                      product.title,
                    url,
                    expiresAt: token.expiresAt.toISOString(),
                    sizeBytes,
                    mimeType: file.mimeType ?? file.sourceFile?.mime ?? undefined,
                  };
                },
              )
            : [];

        return {
          productId: toBigIntString(product.id),
          title: product.title,
          coverUrl: product.coverUrl ?? null,
          pricingType: product.pricingType as PurchaseResultDto['items'][number]['pricingType'],
          downloads,
        };
      }),
    };
  }

  async expirePendingOrders(olderThanMinutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const result = await this.prisma.financeOrder.updateMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT as FinanceOrderStatus,
        OR: [
          { expiresAt: { lt: new Date() } },
          { expiresAt: null, createdAt: { lt: cutoff } },
        ],
      },
      data: { status: OrderStatus.EXPIRED as FinanceOrderStatus },
    });
    return result.count;
  }

  private mapPurchaseStatus(status: OrderStatus): PurchaseResultDto['status'] {
    if (status === OrderStatus.PAID) return 'SUCCESS';
    if (
      status === OrderStatus.FAILED ||
      status === OrderStatus.CANCELLED ||
      status === OrderStatus.EXPIRED
    ) {
      return 'FAILED';
    }
    return 'PENDING';
  }

}
