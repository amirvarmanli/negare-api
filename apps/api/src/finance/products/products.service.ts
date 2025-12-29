import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { toBigInt, toBigIntString } from '@app/finance/common/prisma.utils';
import type { PricingType, Product } from '@prisma/client';
import { ProductPricingType } from '@app/finance/common/finance.enums';

export interface ProductContributorsResult {
  supplierIds: string[];
  supplierCount: number;
}

export interface FinanceProductSnapshot {
  id: string;
  pricingType: ProductPricingType;
  price: number | null;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findProductOrThrow(productId: string): Promise<FinanceProductSnapshot> {
    const product = await this.prisma.product.findUnique({
      where: { id: toBigInt(productId) },
      select: { id: true, pricingType: true, price: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    return this.mapProduct(product);
  }

  async getProductStorageKey(productId: string): Promise<string | null> {
    const file = await this.prisma.productFile.findUnique({
      where: { productId: toBigInt(productId) },
      select: { storageKey: true },
    });
    return file?.storageKey ?? null;
  }

  async resolveContributors(productId: string): Promise<ProductContributorsResult> {
    const contributors = await this.prisma.financeProductContributor.findMany({
      where: { productId: toBigInt(productId) },
    });

    if (contributors.length > 0) {
      return {
        supplierIds: contributors.map((item) => item.supplierId),
        supplierCount: contributors[0].supplierCount,
      };
    }

    const suppliers = await this.prisma.productSupplier.findMany({
      where: { productId: toBigInt(productId) },
    });

    const supplierIds = suppliers.map((item) => item.userId).slice(0, 2);
    const supplierCount = supplierIds.length;

    if (supplierCount === 0) {
      return { supplierIds: [], supplierCount: 0 };
    }

    const entries = supplierIds.map((supplierId) => ({
      productId: toBigInt(productId),
      supplierId,
      supplierCount,
      sharePercent: supplierCount === 2 ? 50 : 70,
    }));

    try {
      await this.prisma.financeProductContributor.createMany({
        data: entries,
        skipDuplicates: true,
      });
    } catch {
      // Ignore unique conflicts from concurrent inserts.
    }

    return { supplierIds, supplierCount };
  }

  async findByIds(productIds: string[]): Promise<FinanceProductSnapshot[]> {
    if (productIds.length === 0) {
      return [];
    }
    const ids = productIds.map(toBigInt);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, pricingType: true, price: true },
    });
    return products.map((product) => this.mapProduct(product));
  }

  private mapProduct(
    product: Pick<Product, 'id' | 'pricingType' | 'price'>,
  ): FinanceProductSnapshot {
    return {
      id: toBigIntString(product.id),
      pricingType: product.pricingType as ProductPricingType,
      price: product.price ? Number(product.price) : null,
    };
  }
}
