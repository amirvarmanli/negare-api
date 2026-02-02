import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { EntitlementSource } from '@app/finance/common/finance.enums';
import { toBigInt, toBigIntString } from '@app/finance/common/prisma.utils';
import { DownloadTokensService } from '@app/finance/downloads/download-tokens.service';
import { buildApiBaseUrl } from '@app/finance/common/api-base-url.util';
import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@app/config/config.module';
import type { PurchasesPageDto, PurchaseItemDto } from '@app/finance/purchases/dto/purchase.dto';
import {
  AdminOrdersQueryDto,
  AdminPurchasePaymentStatus,
} from '@app/finance/purchases/dto/admin-purchases-query.dto';
import type { AdminOrdersListResponseDto } from '@app/finance/purchases/dto/admin-purchases-list.dto';
import { Prisma, FinancePaymentStatus, type FinanceEntitlementSource } from '@prisma/client';

const MAX_PAGE_SIZE = 100;
const ADMIN_PURCHASES_MAX_LIMIT = 100;

const ADMIN_ORDER_SELECT = {
  id: true,
  createdAt: true,
  total: true,
  user: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      username: true,
      phone: true,
      email: true,
    },
  },
  items: {
    select: {
      product: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  },
  payments: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      provider: true,
      trackId: true,
      refId: true,
      status: true,
      createdAt: true,
    },
  },
} satisfies Prisma.FinanceOrderSelect;

type AdminOrderRow = Prisma.FinanceOrderGetPayload<{
  select: typeof ADMIN_ORDER_SELECT;
}>;

const ADMIN_PAYMENT_SUCCESS = new Set<FinancePaymentStatus>([
  FinancePaymentStatus.SUCCESS,
]);
const ADMIN_PAYMENT_PENDING = new Set<FinancePaymentStatus>([
  FinancePaymentStatus.PENDING,
]);
const ADMIN_PAYMENT_FAILED = new Set<FinancePaymentStatus>([
  FinancePaymentStatus.FAILED,
  FinancePaymentStatus.CANCELED,
]);

export function mapPaymentStatusToAdminStatus(
  status?: FinancePaymentStatus | null,
): AdminPurchasePaymentStatus {
  if (!status) {
    return AdminPurchasePaymentStatus.PENDING;
  }
  if (ADMIN_PAYMENT_SUCCESS.has(status)) {
    return AdminPurchasePaymentStatus.SUCCESS;
  }
  if (ADMIN_PAYMENT_PENDING.has(status)) {
    return AdminPurchasePaymentStatus.PENDING;
  }
  if (ADMIN_PAYMENT_FAILED.has(status)) {
    return AdminPurchasePaymentStatus.FAILED;
  }
  return AdminPurchasePaymentStatus.PENDING;
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly downloadTokens: DownloadTokensService,
    private readonly config: ConfigService<AllConfig>,
  ) {}

  async listAdminPurchases(
    query: AdminOrdersQueryDto,
  ): Promise<AdminOrdersListResponseDto> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit
      ? Math.min(Math.max(1, query.limit), ADMIN_PURCHASES_MAX_LIMIT)
      : 20;
    const skip = (page - 1) * limit;

    const filters: Prisma.FinanceOrderWhereInput[] = [];

    if (query.from || query.to) {
      filters.push({
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      });
    }

    if (query.status) {
      const paymentStatuses =
        this.mapAdminStatusToPaymentStatuses(query.status);
      if (query.status === AdminPurchasePaymentStatus.PENDING) {
        filters.push({
          OR: [
            { payments: { none: {} } },
            { payments: { some: { status: { in: paymentStatuses } } } },
          ],
        });
      } else {
        filters.push({
          payments: { some: { status: { in: paymentStatuses } } },
        });
      }
    }

    if (query.q) {
      const term = query.q;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        term,
      );
      filters.push({
        OR: [
          ...(isUuid ? [{ id: term }] : []),
          {
            user: {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { phone: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
          {
            payments: {
              some: { trackId: { contains: term, mode: 'insensitive' } },
            },
          },
          {
            payments: {
              some: { refId: { contains: term, mode: 'insensitive' } },
            },
          },
        ],
      });
    }

    const where: Prisma.FinanceOrderWhereInput =
      filters.length > 0 ? { AND: filters } : {};

    const [rows, total] = await Promise.all([
      this.prisma.financeOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: ADMIN_ORDER_SELECT,
      }),
      this.prisma.financeOrder.count({ where }),
    ]);

    const items = rows.map((row) => this.mapAdminOrderRow(row));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async listForUser(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PurchasesPageDto> {
    const safePage = Number.isFinite(page) ? Math.max(1, page) : 1;
    const safePageSize = Number.isFinite(pageSize)
      ? Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE)
      : 20;
    const skip = (safePage - 1) * safePageSize;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.financeEntitlement.findMany({
        where: {
          userId,
          source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
        },
        orderBy: { purchasedAt: 'desc' },
        skip,
        take: safePageSize,
        select: {
          productId: true,
          orderId: true,
          purchasedAt: true,
          product: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
            },
          },
        },
      }),
      this.prisma.financeEntitlement.count({
        where: {
          userId,
          source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
        },
      }),
    ]);

    const productIds = rows.map((row) => row.productId);
    const files = productIds.length
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
    const items: PurchaseItemDto[] = rows.map((row) =>
      this.buildPurchaseItem(row, filesByProductId, apiBaseUrl, userId),
    );

    return {
      page: safePage,
      pageSize: safePageSize,
      total,
      items,
    };
  }

  async getForUserProduct(
    userId: string,
    productId: string,
  ): Promise<PurchaseItemDto> {
    const entitlement = await this.prisma.financeEntitlement.findFirst({
      where: {
        userId,
        productId: toBigInt(productId),
        source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
      },
        select: {
          productId: true,
          orderId: true,
          purchasedAt: true,
          product: {
            select: {
              id: true,
              title: true,
            coverUrl: true,
          },
        },
      },
      orderBy: { purchasedAt: 'desc' },
    });
    if (!entitlement) {
      throw new NotFoundException('Purchase not found.');
    }

    const files = await this.prisma.productFile.findMany({
      where: { productId: entitlement.productId },
      select: {
        id: true,
        productId: true,
        originalName: true,
        mimeType: true,
        size: true,
        sourceFile: { select: { filename: true, mime: true, size: true } },
      },
    });

    const filesByProductId = new Map<string, typeof files>();
    if (files.length > 0) {
      filesByProductId.set(toBigIntString(entitlement.productId), files);
    }

    const apiBaseUrl = buildApiBaseUrl(this.config);
    return this.buildPurchaseItem(
      entitlement,
      filesByProductId,
      apiBaseUrl,
      userId,
    );
  }

  private buildPurchaseItem(
    row: {
      productId: bigint;
      orderId: string | null;
      purchasedAt: Date;
      product: { id: bigint; title: string; coverUrl: string | null };
    },
    filesByProductId: Map<
      string,
      Array<{
        id: bigint;
        productId: bigint;
        originalName: string | null;
        mimeType: string | null;
        size: bigint | null;
        sourceFile: { filename: string; mime: string; size: bigint } | null;
      }>
    >,
    apiBaseUrl: string,
    userId: string,
  ): PurchaseItemDto {
    const productId = toBigIntString(row.productId);
    const orderId = row.orderId ?? '';
    const files = filesByProductId.get(productId) ?? [];
    const downloads = orderId
      ? files.map((file) => {
          const fileId = toBigIntString(file.id);
          const token = this.downloadTokens.signDownloadToken({
            userId,
            orderId,
            fileId,
          });
          const sizeBytes =
            file.size !== null && file.size !== undefined
              ? Number(file.size)
              : file.sourceFile?.size !== null &&
                  file.sourceFile?.size !== undefined
                ? Number(file.sourceFile.size)
                : undefined;
          return {
            fileId,
            url: new URL(
              `downloads/files/${fileId}?token=${encodeURIComponent(
                token.token,
              )}`,
              apiBaseUrl,
            ).toString(),
            expiresAt: token.expiresAt.toISOString(),
            sizeBytes,
            mimeType: file.mimeType ?? file.sourceFile?.mime ?? undefined,
          };
        })
      : [];

    return {
      productId,
      title: row.product.title,
      coverUrl: row.product.coverUrl ?? null,
      purchasedAt: row.purchasedAt.toISOString(),
      orderId,
      downloads,
    };
  }

  private mapAdminOrderRow(row: AdminOrderRow) {
    const payment = row.payments?.[0];
    const paymentStatus = mapPaymentStatusToAdminStatus(payment?.status);
    const buyerName = this.resolveBuyerFullName(row.user);

    return {
      orderId: row.id,
      createdAt: row.createdAt.toISOString(),
      buyer: {
        id: row.user.id,
        fullName: buyerName,
        phone: row.user.phone ?? null,
        email: row.user.email ?? null,
      },
      products: row.items.map((item) => ({
        id: toBigIntString(item.product.id),
        title: item.product.title,
      })),
      amount: { total: row.total },
      paymentStatus,
      payment: payment
        ? {
            id: payment.id,
            provider: payment.provider,
            trackId: payment.trackId ?? null,
            refId: payment.refId ?? null,
          }
        : undefined,
    };
  }

  private resolveBuyerFullName(user: {
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    email: string | null;
    phone: string | null;
  }): string {
    const name = user.name?.trim();
    if (name) {
      return name;
    }
    const combined = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    if (combined) {
      return combined;
    }
    return (user.username ?? user.email ?? user.phone ?? 'User').toString();
  }

  private mapAdminStatusToPaymentStatuses(
    status: AdminPurchasePaymentStatus,
  ): FinancePaymentStatus[] {
    if (status === AdminPurchasePaymentStatus.SUCCESS) {
      return [FinancePaymentStatus.SUCCESS];
    }
    if (status === AdminPurchasePaymentStatus.FAILED) {
      return [FinancePaymentStatus.FAILED, FinancePaymentStatus.CANCELED];
    }
    return [FinancePaymentStatus.PENDING];
  }
}
