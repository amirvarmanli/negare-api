import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { EntitlementSource } from '@app/finance/common/finance.enums';
import { toBigInt, toBigIntString } from '@app/finance/common/prisma.utils';
import { DownloadTokensService } from '@app/finance/downloads/download-tokens.service';
import { buildApiBaseUrl } from '@app/finance/common/api-base-url.util';
import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@app/config/config.module';
import type { PurchasesPageDto, PurchaseItemDto } from '@app/finance/purchases/dto/purchase.dto';
import type { FinanceEntitlementSource } from '@prisma/client';

const MAX_PAGE_SIZE = 100;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly downloadTokens: DownloadTokensService,
    private readonly config: ConfigService<AllConfig>,
  ) {}

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
}
