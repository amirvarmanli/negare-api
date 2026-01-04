import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RoleName } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@app/prisma/prisma.service';
import { AllConfig } from '@app/config/config.module';
import {
  AdminUsersQueryDto,
  AdminUsersSortBy,
  SortDirection,
} from '@app/core/users/admin/dto/admin-users-query.dto';
import {
  AdminUserDto,
  AdminUserSkillDto,
} from '@app/core/users/admin/dto/admin-user.dto';
import {
  AdminUsersResponseDto,
} from '@app/core/users/admin/dto/admin-users-response.dto';
import { AdminCreateUserDto } from '@app/core/users/admin/dto/admin-create-user.dto';
import { AdminUsersFiltersResponseDto } from '@app/core/users/admin/dto/admin-users-filters.dto';

@Injectable()
export class AdminUsersService {
  private readonly bcryptRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AllConfig>,
  ) {
    this.bcryptRounds = Number(this.config.get('BCRYPT_ROUNDS') ?? 10);
  }

  async listUsers(query: AdminUsersQueryDto): Promise<AdminUsersResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const includeSkills = query.includeSkills ?? query.artistOnly ?? false;
    const includeCity = query.includeCity ?? true;

    const where: Prisma.UserWhereInput = {};
    const andFilters: Prisma.UserWhereInput[] = [];

    if (query.q) {
      andFilters.push({
        OR: [
          { firstName: { contains: query.q, mode: 'insensitive' } },
          { lastName: { contains: query.q, mode: 'insensitive' } },
          { phone: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
          { username: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    if (query.hasProduct === true) {
      andFilters.push({ productSuppliers: { some: {} } });
    } else if (query.hasProduct === false) {
      andFilters.push({ productSuppliers: { none: {} } });
    }

    if (query.artistOnly === true) {
      andFilters.push({
        OR: [
          { role: RoleName.supplier },
          { userRoles: { some: { role: { name: RoleName.supplier } } } },
        ],
      });
    } else if (query.artistOnly === false) {
      andFilters.push({
        role: { not: RoleName.supplier },
        userRoles: { none: { role: { name: RoleName.supplier } } },
      });
    }

    if (query.cityId) {
      andFilters.push({ cityId: query.cityId });
    }

    if (query.skillIds && query.skillIds.length > 0) {
      andFilters.push({ skills: { some: { skillId: { in: query.skillIds } } } });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const sortBy = query.sortBy ?? AdminUsersSortBy.createdAt;
    const sortDir = query.sortDir ?? SortDirection.desc;

    const orderBy = this.buildOrderBy(sortBy, sortDir);

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
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
          cityRef: includeCity
            ? {
                select: {
                  id: true,
                  name: true,
                },
              }
            : undefined,
          skills: includeSkills
            ? {
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
              }
            : undefined,
          _count: {
            select: {
              productSuppliers: true,
            },
          },
        },
      }),
    ]);

    const items: AdminUserDto[] = users.map((user) => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      city: includeCity
        ? user.cityRef
          ? { id: user.cityRef.id, name: user.cityRef.name }
          : null
        : undefined,
      productsCount: user._count.productSuppliers,
      skills: includeSkills
        ? (user.skills ?? []).map((entry): AdminUserSkillDto => {
            const name =
              entry.skill.nameFa ?? entry.skill.nameEn ?? entry.skill.key;
            return {
              id: entry.skill.id,
              name,
              slug: entry.skill.key,
            };
          })
        : undefined,
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

  private buildOrderBy(
    sortBy: AdminUsersSortBy,
    sortDir: SortDirection,
  ): Prisma.UserOrderByWithRelationInput[] {
    switch (sortBy) {
      case AdminUsersSortBy.firstName:
        return [{ firstName: sortDir }, { createdAt: 'desc' }];
      case AdminUsersSortBy.lastName:
        return [{ lastName: sortDir }, { createdAt: 'desc' }];
      case AdminUsersSortBy.productsCount:
        return [{ productSuppliers: { _count: sortDir } }, { createdAt: 'desc' }];
      case AdminUsersSortBy.cityName:
        return [{ cityRef: { name: sortDir } }, { createdAt: 'desc' }];
      case AdminUsersSortBy.createdAt:
      default:
        return [{ createdAt: sortDir }];
    }
  }
}
