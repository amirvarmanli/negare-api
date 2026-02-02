import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FinancePaymentStatus,
  FinanceRevenueBeneficiaryType,
  FinanceWalletTransactionType,
  Prisma,
  RoleName,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@app/prisma/prisma.service';
import { AllConfig } from '@app/config/config.module';
import {
  AdminUsersQueryDto,
  AdminUsersSort,
} from '@app/core/users/admin/dto/admin-users-query.dto';
import type { AdminUserDto } from '@app/core/users/admin/dto/admin-user.dto';
import { AdminUsersListResponseDto } from '@app/core/users/admin/dto/admin-users-list.dto';
import { AdminUserDetailResponseDto } from '@app/core/users/admin/dto/admin-user-detail.dto';
import {
  AdminUserDownloadsQueryDto,
  AdminUserDownloadsResponseDto,
  AdminUserNotificationsResponseDto,
  AdminUserPurchasePaymentStatus,
  AdminUserPurchasesResponseDto,
  AdminUserSubresourceQueryDto,
  AdminUserTransactionsResponseDto,
} from '@app/core/users/admin/dto/admin-user-subresources.dto';
import { AdminCreateUserDto } from '@app/core/users/admin/dto/admin-create-user.dto';
import { AdminUsersFiltersResponseDto } from '@app/core/users/admin/dto/admin-users-filters.dto';
import { parseTehranDateKeyToDate } from '@app/finance/common/date.utils';
import { toBigIntString } from '@app/finance/common/prisma.utils';
import { walletReasonDisplay } from '@app/finance/wallet/wallet-reason.mapper';

@Injectable()
export class AdminUsersService {
  private readonly bcryptRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AllConfig>,
  ) {
    this.bcryptRounds = Number(this.config.get('BCRYPT_ROUNDS') ?? 10);
  }

  async listUsers(
    query: AdminUsersQueryDto,
  ): Promise<AdminUsersListResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const term = query.q?.trim();

    const filters: Prisma.UserWhereInput[] = [];

    if (term) {
      filters.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { city: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    if (query.role) {
      filters.push({
        OR: [
          { role: query.role },
          { userRoles: { some: { role: { name: query.role } } } },
        ],
      });
    }

    if (query.city) {
      filters.push({
        city: { equals: query.city, mode: 'insensitive' },
      });
    }

    if (query.from || query.to) {
      filters.push({
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      });
    }

    const where: Prisma.UserWhereInput =
      filters.length > 0 ? { AND: filters } : {};

    const orderBy = this.buildListOrderBy(
      query.sort ?? AdminUsersSort.createdAtDesc,
    );

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          avatarUrl: true,
          name: true,
          username: true,
          phone: true,
          email: true,
          city: true,
          role: true,
          createdAt: true,
          userRoles: {
            select: {
              role: { select: { name: true } },
            },
          },
          _count: {
            select: {
              financeOrders: true,
              downloadEvents: true,
            },
          },
        },
      }),
    ]);

    const items = users.map((user) => ({
      id: user.id,
      username: user.username,
      phone: user.phone,
      email: user.email,
      avatarUrl: user.avatarUrl,
      name: this.resolveUserName(user.name),
      role: this.resolvePrimaryRole(user.role, user.userRoles),
      city: user.city,
      stats: {
        purchasesCount: user._count.financeOrders,
        downloadsCount: user._count.downloadEvents,
      },
      createdAt: user.createdAt.toISOString(),
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getUserDetail(id: string): Promise<AdminUserDetailResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        avatarUrl: true,
        name: true,
        username: true,
        phone: true,
        email: true,
        city: true,
        bio: true,
        role: true,
        createdAt: true,
        userRoles: {
          select: {
            role: { select: { name: true } },
          },
        },
        skills: {
          select: {
            skill: {
              select: {
                id: true,
                key: true,
                nameFa: true,
                nameEn: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isSupplier = this.isSupplierRole(user.role, user.userRoles);

    const [
      wallet,
      purchasesCount,
      downloadsCount,
      transactionsCount,
      notificationsCount,
    ] = await Promise.all([
      this.prisma.financeWallet.findUnique({
        where: { userId: id },
        select: { balance: true },
      }),
      this.prisma.financeOrder.count({ where: { userId: id } }),
      this.prisma.downloadEvent.count({ where: { userId: id } }),
      this.prisma.financeWalletTransaction.count({ where: { userId: id } }),
      this.prisma.userNotification.count({ where: { userId: id } }),
    ]);

    const supplierEarningsTotal = isSupplier
      ? await this.getSupplierEarningsTotal(id)
      : null;

    return {
      user: {
        id: user.id,
        avatarUrl: user.avatarUrl,
        name: this.resolveUserName(user.name),
        username: user.username,
        phone: user.phone,
        email: user.email,
        city: user.city,
        bio: user.bio,
        role: this.resolvePrimaryRole(user.role, user.userRoles),
        skills: (user.skills ?? []).map((entry) => ({
          id: entry.skill.id,
          title: this.resolveSkillTitle(entry.skill),
        })),
        createdAt: user.createdAt.toISOString(),
      },
      financial: {
        walletBalance: wallet?.balance ?? 0,
        supplierEarningsTotal,
      },
      stats: {
        purchasesCount,
        downloadsCount,
        transactionsCount,
        notificationsCount,
      },
    };
  }

  async listUserPurchases(
    userId: string,
    query: AdminUserSubresourceQueryDto,
  ): Promise<AdminUserPurchasesResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.financeOrder.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          createdAt: true,
          total: true,
          payments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              status: true,
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
        },
      }),
      this.prisma.financeOrder.count({ where: { userId } }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      total: row.total,
      paymentStatus: this.mapPaymentStatus(row.payments[0]?.status),
      products: row.items.map((item) => ({
        id: toBigIntString(item.product.id),
        title: item.product.title,
      })),
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listUserDownloads(
    userId: string,
    query: AdminUserDownloadsQueryDto,
  ): Promise<AdminUserDownloadsResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.from) {
      dateFilter.gte = parseTehranDateKeyToDate(query.from);
    }
    if (query.to) {
      const end = parseTehranDateKeyToDate(query.to);
      dateFilter.lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    const where: Prisma.DownloadEventWhereInput = {
      userId,
      ...(query.freeOnly ? { isFree: true } : {}),
      ...(Object.keys(dateFilter).length > 0 ? { occurredAt: dateFilter } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.downloadEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          occurredAt: true,
          isFree: true,
          ip: true,
          userAgent: true,
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.downloadEvent.count({ where }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      isFree: row.isFree,
      product: {
        id: toBigIntString(row.product.id),
        title: row.product.title,
        slug: row.product.slug,
      },
      ip: row.ip ?? null,
      userAgent: row.userAgent ?? null,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listUserTransactions(
    userId: string,
    query: AdminUserSubresourceQueryDto,
  ): Promise<AdminUserTransactionsResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.financeWalletTransaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          createdAt: true,
          amount: true,
          type: true,
          reason: true,
          description: true,
          referenceId: true,
        },
      }),
      this.prisma.financeWalletTransaction.count({ where: { userId } }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      amount:
        row.type === FinanceWalletTransactionType.DEBIT
          ? -row.amount
          : row.amount,
      label: walletReasonDisplay(row.reason, row.description ?? null),
      referenceId: row.referenceId ?? null,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listUserNotifications(
    userId: string,
    query: AdminUserSubresourceQueryDto,
  ): Promise<AdminUserNotificationsResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.userNotification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          createdAt: true,
          status: true,
          notification: {
            select: {
              title: true,
              body: true,
            },
          },
        },
      }),
      this.prisma.userNotification.count({ where: { userId } }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      title: row.notification.title,
      body: row.notification.body,
      status: row.status,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async createUser(dto: AdminCreateUserDto): Promise<AdminUserDto> {
    const role = dto.role ?? RoleName.user;

    if (dto.cityId) {
      const cityExists = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
        select: { id: true },
      });
      if (!cityExists) {
        throw new BadRequestException('City not found.');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
    const fullName = `${dto.firstName} ${dto.lastName}`.trim();

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username: dto.username,
            firstName: dto.firstName,
            lastName: dto.lastName,
            name: fullName,
            phone: dto.phone,
            email: dto.email,
            avatarUrl: dto.avatarUrl ?? null,
            bio: dto.bio ?? null,
            cityId: dto.cityId ?? null,
            role,
            passwordHash,
          },
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            avatarUrl: true,
            bio: true,
            role: true,
            createdAt: true,
            cityRef: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                productSuppliers: true,
              },
            },
          },
        });

        const roleRecord = await tx.role.upsert({
          where: { name: role },
          update: {},
          create: { name: role },
        });

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: roleRecord.id,
          },
        });

        return user;
      });

      return {
        id: created.id,
        username: created.username,
        firstName: created.firstName,
        lastName: created.lastName,
        phone: created.phone,
        email: created.email,
        avatarUrl: created.avatarUrl,
        bio: created.bio,
        role: created.role,
        city: created.cityRef
          ? { id: created.cityRef.id, name: created.cityRef.name }
          : null,
        productsCount: created._count.productSuppliers,
        createdAt: created.createdAt.toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const fields = Array.isArray(error.meta?.target)
            ? error.meta?.target.join(', ')
            : 'unique field';
          throw new BadRequestException(
            `User with the same ${fields} already exists.`,
          );
        }
      }
      throw error;
    }
  }

  async getFilters(): Promise<AdminUsersFiltersResponseDto> {
    const [cities, skills] = await this.prisma.$transaction([
      this.prisma.city.findMany({
        select: { id: true, name: true, province: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.skill.findMany({
        select: { id: true, key: true, nameFa: true, nameEn: true },
        orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
      }),
    ]);

    return {
      cities: cities.map((city) => ({
        id: city.id,
        name: city.name,
        province: city.province,
      })),
      skills: skills.map((skill) => ({
        id: skill.id,
        name: skill.nameFa ?? skill.nameEn ?? skill.key,
        slug: skill.key,
      })),
    };
  }

  private buildListOrderBy(
    sort: AdminUsersSort,
  ): Prisma.UserOrderByWithRelationInput[] {
    if (sort === AdminUsersSort.createdAtAsc) {
      return [{ createdAt: 'asc' }, { id: 'asc' }];
    }
    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }

  private resolveUserName(name: string | null): string {
    return name ?? '';
  }

  private resolvePrimaryRole(
    role: RoleName,
    userRoles?: Array<{ role: { name: RoleName } }>,
  ): RoleName {
    if (role) {
      return role;
    }
    const fallback = userRoles?.[0]?.role?.name;
    return fallback ?? RoleName.user;
  }

  private isSupplierRole(
    role: RoleName,
    userRoles?: Array<{ role: { name: RoleName } }>,
  ): boolean {
    if (role === RoleName.supplier) {
      return true;
    }
    return userRoles?.some((entry) => entry.role?.name === RoleName.supplier) ?? false;
  }

  private resolveSkillTitle(skill: {
    key: string;
    nameFa: string | null;
    nameEn: string | null;
  }): string {
    return skill.nameFa ?? skill.nameEn ?? skill.key;
  }

  private async getSupplierEarningsTotal(
    supplierId: string,
  ): Promise<number> {
    const [orderSum, subscriptionSum] = await Promise.all([
      this.prisma.financeOrderRevenueSplit.aggregate({
        where: {
          supplierId,
          beneficiaryType: FinanceRevenueBeneficiaryType.SUPPLIER,
        },
        _sum: { amount: true },
      }),
      this.prisma.financeSubscriptionSupplierEarning.aggregate({
        where: { supplierId },
        _sum: { amount: true },
      }),
    ]);

    return (orderSum._sum.amount ?? 0) + (subscriptionSum._sum.amount ?? 0);
  }

  private mapPaymentStatus(
    status?: FinancePaymentStatus | null,
  ): AdminUserPurchasePaymentStatus {
    if (!status) {
      return AdminUserPurchasePaymentStatus.PENDING;
    }
    if (status === FinancePaymentStatus.SUCCESS) {
      return AdminUserPurchasePaymentStatus.SUCCESS;
    }
    if (status === FinancePaymentStatus.PENDING) {
      return AdminUserPurchasePaymentStatus.PENDING;
    }
    return AdminUserPurchasePaymentStatus.FAILED;
  }
}
