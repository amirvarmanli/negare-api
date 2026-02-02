import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { toBigIntString } from '@app/finance/common/prisma.utils';
import { RevenueBeneficiaryType } from '@app/finance/common/finance.enums';
import type { AdminCreditsListResponseDto } from '@app/finance/credits/dto/admin-credits-list.dto';
import {
  AdminCreditType,
  AdminCreditsQueryDto,
} from '@app/finance/credits/dto/admin-credits-query.dto';
import type { Prisma } from '@prisma/client';

const ADMIN_CREDITS_MAX_LIMIT = 100;

const ORDER_CREDIT_SELECT = {
  id: true,
  createdAt: true,
  supplierId: true,
  amount: true,
  product: {
    select: {
      id: true,
      title: true,
    },
  },
} satisfies Prisma.FinanceOrderRevenueSplitSelect;

type OrderCreditRow = Prisma.FinanceOrderRevenueSplitGetPayload<{
  select: typeof ORDER_CREDIT_SELECT;
}>;

const SUBSCRIPTION_CREDIT_SELECT = {
  id: true,
  createdAt: true,
  supplierId: true,
  amount: true,
  pool: {
    select: {
      periodStart: true,
      periodEnd: true,
    },
  },
} satisfies Prisma.FinanceSubscriptionSupplierEarningSelect;

type SubscriptionCreditRow = Prisma.FinanceSubscriptionSupplierEarningGetPayload<{
  select: typeof SUBSCRIPTION_CREDIT_SELECT;
}>;

type CreditRow =
  | {
      id: string;
      createdAt: Date;
      type: AdminCreditType.PRODUCT_PURCHASE;
      supplierId: string | null;
      amount: number;
      product: { id: string; title: string };
    }
  | {
      id: string;
      createdAt: Date;
      type: AdminCreditType.SUBSCRIPTION_PURCHASE;
      supplierId: string;
      amount: number;
      subscription: { title: string };
    };

@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdminCredits(
    query: AdminCreditsQueryDto,
  ): Promise<AdminCreditsListResponseDto> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit
      ? Math.min(Math.max(1, query.limit), ADMIN_CREDITS_MAX_LIMIT)
      : 20;
    const skip = (page - 1) * limit;
    const take = skip + limit;
    const term = query.q?.trim();

    const supplierIdsFromSearch = term
      ? await this.findSupplierIds(term)
      : null;

    const createdAtFilter = this.buildCreatedAtFilter(query);
    const wantsProduct =
      !query.type || query.type === AdminCreditType.PRODUCT_PURCHASE;
    const wantsSubscription =
      !query.type || query.type === AdminCreditType.SUBSCRIPTION_PURCHASE;

    const orderWhere = wantsProduct
      ? this.buildOrderWhere({
          supplierId: query.supplierId,
          createdAt: createdAtFilter,
          term,
          supplierIdsFromSearch,
        })
      : undefined;

    const subscriptionWhere = wantsSubscription
      ? this.buildSubscriptionWhere({
          supplierId: query.supplierId,
          createdAt: createdAtFilter,
          term,
          supplierIdsFromSearch,
        })
      : undefined;

    const [orderRows, subscriptionRows, orderTotal, subscriptionTotal] =
      await Promise.all([
        wantsProduct
          ? this.prisma.financeOrderRevenueSplit.findMany({
              where: orderWhere,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take,
              select: ORDER_CREDIT_SELECT,
            })
          : Promise.resolve([] as OrderCreditRow[]),
        wantsSubscription && subscriptionWhere !== null
          ? this.prisma.financeSubscriptionSupplierEarning.findMany({
              where: subscriptionWhere,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take,
              select: SUBSCRIPTION_CREDIT_SELECT,
            })
          : Promise.resolve([] as SubscriptionCreditRow[]),
        wantsProduct
          ? this.prisma.financeOrderRevenueSplit.count({ where: orderWhere })
          : Promise.resolve(0),
        wantsSubscription && subscriptionWhere !== null
          ? this.prisma.financeSubscriptionSupplierEarning.count({
              where: subscriptionWhere,
            })
          : Promise.resolve(0),
      ]);

    const credits = this.mergeCredits(orderRows, subscriptionRows);

    const paged = credits.slice(skip, skip + limit);
    const supplierMap = await this.loadSuppliers(paged);

    return {
      items: paged.map((row) => this.toAdminCreditRow(row, supplierMap)),
      meta: {
        page,
        limit,
        total: orderTotal + subscriptionTotal,
        totalPages: limit > 0 ? Math.ceil((orderTotal + subscriptionTotal) / limit) : 0,
      },
    };
  }

  private buildCreatedAtFilter(query: AdminCreditsQueryDto):
    | { gte?: Date; lte?: Date }
    | undefined {
    if (!query.from && !query.to) {
      return undefined;
    }
    return {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }

  private buildOrderWhere(params: {
    supplierId?: string;
    createdAt?: { gte?: Date; lte?: Date };
    term?: string;
    supplierIdsFromSearch?: string[] | null;
  }): Prisma.FinanceOrderRevenueSplitWhereInput {
    const filters: Prisma.FinanceOrderRevenueSplitWhereInput[] = [
      { beneficiaryType: RevenueBeneficiaryType.SUPPLIER },
    ];

    if (params.supplierId) {
      filters.push({ supplierId: params.supplierId });
    }

    if (params.createdAt) {
      filters.push({ createdAt: params.createdAt });
    }

    if (params.term) {
      const orFilters: Prisma.FinanceOrderRevenueSplitWhereInput[] = [
        {
          product: {
            title: { contains: params.term, mode: 'insensitive' },
          },
        },
      ];

      if (params.supplierIdsFromSearch?.length) {
        orFilters.push({
          supplierId: { in: params.supplierIdsFromSearch },
        });
      }

      filters.push({ OR: orFilters });
    }

    return filters.length > 0 ? { AND: filters } : {};
  }

  private buildSubscriptionWhere(params: {
    supplierId?: string;
    createdAt?: { gte?: Date; lte?: Date };
    term?: string;
    supplierIdsFromSearch?: string[] | null;
  }): Prisma.FinanceSubscriptionSupplierEarningWhereInput | null {
    const filters: Prisma.FinanceSubscriptionSupplierEarningWhereInput[] = [];

    if (params.supplierId) {
      filters.push({ supplierId: params.supplierId });
    }

    if (params.createdAt) {
      filters.push({ createdAt: params.createdAt });
    }

    if (params.term) {
      if (!params.supplierIdsFromSearch?.length) {
        return null;
      }
      filters.push({ supplierId: { in: params.supplierIdsFromSearch } });
    }

    return filters.length > 0 ? { AND: filters } : {};
  }

  private mergeCredits(
    orderRows: OrderCreditRow[],
    subscriptionRows: SubscriptionCreditRow[],
  ): CreditRow[] {
    const items: CreditRow[] = [
      ...orderRows.map((row): CreditRow => ({
        id: row.id,
        createdAt: row.createdAt,
        type: AdminCreditType.PRODUCT_PURCHASE,
        supplierId: row.supplierId,
        amount: row.amount,
        product: {
          id: toBigIntString(row.product.id),
          title: row.product.title,
        },
      })),
      ...subscriptionRows.map((row): CreditRow => ({
        id: row.id,
        createdAt: row.createdAt,
        type: AdminCreditType.SUBSCRIPTION_PURCHASE,
        supplierId: row.supplierId,
        amount: row.amount,
        subscription: {
          title: this.formatSubscriptionTitle(row.pool),
        },
      })),
    ];

    items.sort((a, b) => {
      const createdDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (createdDiff !== 0) {
        return createdDiff;
      }
      return b.id.localeCompare(a.id);
    });

    return items;
  }

  private async loadSuppliers(
    items: CreditRow[],
  ): Promise<Map<string, {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
  }>> {
    const ids = Array.from(
      new Set(
        items
          .map((item) => item.supplierId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (ids.length === 0) {
      return new Map();
    }

    const suppliers = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        username: true,
        phone: true,
        email: true,
        avatarUrl: true,
      },
    });

    return new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  }

  private toAdminCreditRow(
    row: CreditRow,
    supplierMap: Map<string, {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      phone: string | null;
      email: string | null;
      avatarUrl: string | null;
    }>,
  ): AdminCreditsListResponseDto['items'][number] {
    const supplier = row.supplierId ? supplierMap.get(row.supplierId) : null;
    const supplierName = this.resolveSupplierName(supplier);

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      type: row.type,
      supplier: {
        id: row.supplierId ?? 'unknown',
        fullName: supplierName,
        phone: supplier?.phone ?? null,
        email: supplier?.email ?? null,
        avatarUrl: supplier?.avatarUrl ?? null,
      },
      amount: { total: row.amount },
      product:
        row.type === AdminCreditType.PRODUCT_PURCHASE
          ? row.product
          : undefined,
      subscription:
        row.type === AdminCreditType.SUBSCRIPTION_PURCHASE
          ? row.subscription
          : undefined,
    };
  }

  private resolveSupplierName(user?: {
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    email: string | null;
    phone: string | null;
  } | null): string {
    if (!user) {
      return 'Supplier';
    }
    const name = user.name?.trim();
    if (name) {
      return name;
    }
    const combined = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    if (combined) {
      return combined;
    }
    return (user.username ?? user.email ?? user.phone ?? 'Supplier').toString();
  }

  private formatSubscriptionTitle(pool: {
    periodStart: Date;
    periodEnd: Date;
  }): string {
    return `Subscription pool ${pool.periodStart.toISOString().slice(0, 10)} - ${pool.periodEnd
      .toISOString()
      .slice(0, 10)}`;
  }

  private async findSupplierIds(term: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }
}
