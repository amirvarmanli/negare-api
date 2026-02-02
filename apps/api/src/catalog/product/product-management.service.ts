import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PricingType, ProductStatus } from '@prisma/client';
import { PrismaService } from '@app/prisma/prisma.service';
import {
  Actor,
  ProductService,
  buildProductIdOrSlugWhere,
  makeTextWhere,
  toBigIntList,
} from '@app/catalog/product/product.service';
import { ProductMapper, productInclude, ProductWithRelations } from '@app/catalog/product/product.mapper';
import {
  ProductManagementQueryDto,
  ProductManagementSortBy,
  SortDirection,
} from '@app/catalog/product/dtos/product-management-query.dto';
import { ProductDetailDto, ProductListItemDto, ProductManagementPaginatedResultDto } from '@app/catalog/product/dtos/product-response.dto';
import { CreateProductDto } from '@app/catalog/product/dtos/product-create.dto';
import { UpdateProductDto } from '@app/catalog/product/dtos/product-update.dto';
import { AdminProductCreateDto } from '@app/catalog/product/dtos/product-admin-create.dto';
import { clampPagination, toPaginationResult } from '@app/catalog/utils/pagination.util';

export type ProductManagementScope =
  | { type: 'admin' }
  | { type: 'owner'; ownerId: string };

type ProductListOptions = {
  includeOwner: boolean;
  includeRelations: boolean;
};

const OWNER_VISIBLE_PRODUCT_STATUSES: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.PUBLISHED,
];

@Injectable()
export class ProductManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

  async list(
    scope: ProductManagementScope,
    query: ProductManagementQueryDto,
  ): Promise<ProductManagementPaginatedResultDto> {
    const { page, limit, skip } = clampPagination(
      query.page,
      query.limit ?? 20,
      100,
    );
    const where = this.buildWhere(scope, query);
    const orderBy = this.buildOrderBy(query.sortBy, query.sortDir);
    const options: ProductListOptions = {
      includeOwner: query.includeOwner !== false,
      includeRelations: query.includeRelations !== false,
    };

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: productInclude,
      }),
      this.prisma.product.count({ where }),
    ]);

    const items: ProductListItemDto[] = (rows as ProductWithRelations[]).map(
      (product) => ProductMapper.toListItem(product, options),
    );

    const result = toPaginationResult(items, total, page, limit);
    return {
      items: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNext: result.hasNext,
    };
  }

  async findOne(
    scope: ProductManagementScope,
    idOrSlug: string,
  ): Promise<ProductDetailDto> {
    const product = await this.getManagedProduct(scope, idOrSlug);
    return ProductMapper.toDetail(product);
  }

  async create(
    scope: ProductManagementScope,
    dto: CreateProductDto | AdminProductCreateDto,
    actor: Actor,
  ): Promise<ProductDetailDto> {
    const payload = this.normalizeCreateDto(scope, dto, actor);
    return this.productService.create(payload, actor);
  }

  async update(
    scope: ProductManagementScope,
    idOrSlug: string,
    dto: UpdateProductDto,
    actor: Actor,
  ): Promise<ProductDetailDto> {
    if (scope.type === 'owner' && dto.authorIds) {
      const invalid =
        dto.authorIds.length === 0 ||
        dto.authorIds.some((authorId) => authorId !== scope.ownerId);
      if (invalid) {
        throw new ForbiddenException('Suppliers cannot change product authors.');
      }
    }
    await this.getManagedProduct(scope, idOrSlug);
    return this.productService.update(idOrSlug, dto, actor);
  }

  async archive(
    scope: ProductManagementScope,
    idOrSlug: string,
  ): Promise<void> {
    const product = await this.getManagedProduct(scope, idOrSlug);
    await this.prisma.product.update({
      where: { id: product.id },
      data: { status: ProductStatus.ARCHIVED },
    });
  }

  async downloadFile(
    idOrSlug: string,
    actor: Actor,
  ): ReturnType<ProductService['downloadProductFile']> {
    return this.productService.downloadProductFile(idOrSlug, actor);
  }

  private buildWhere(
    scope: ProductManagementScope,
    query: ProductManagementQueryDto,
  ): Prisma.ProductWhereInput {
    const ands: Prisma.ProductWhereInput[] = [];
    const text = makeTextWhere(query.q);
    if (text) ands.push(text);

    if (query.pricingType) {
      ands.push({ pricingType: query.pricingType as PricingType });
    }
    if (query.status) {
      ands.push({ status: query.status as ProductStatus });
    } else if (scope.type === 'owner') {
      ands.push({ status: { in: OWNER_VISIBLE_PRODUCT_STATUSES } });
    }

    if (scope.type === 'owner') {
      ands.push({ supplierLinks: { some: { userId: scope.ownerId } } });
    } else if (query.ownerId) {
      ands.push({ supplierLinks: { some: { userId: query.ownerId } } });
    }

    const categoryIds = toBigIntList(query.categoryId);
    if (categoryIds.length > 0) {
      ands.push({
        categoryLinks: { some: { categoryId: { in: categoryIds } } },
      });
    }

    const topicIds = toBigIntList(query.topicId);
    if (topicIds.length > 0) {
      ands.push({
        topics: { some: { topicId: { in: topicIds } } },
      });
    }

    const tagIds = toBigIntList(query.tagId);
    if (tagIds.length > 0) {
      ands.push({
        tagLinks: { some: { tagId: { in: tagIds } } },
      });
    }

    return ands.length ? { AND: ands } : {};
  }

  private buildOrderBy(
    sortBy?: ProductManagementSortBy,
    sortDir?: SortDirection,
  ): Prisma.ProductOrderByWithRelationInput[] {
    const direction = sortDir ?? SortDirection.desc;
    const key = sortBy ?? ProductManagementSortBy.createdAt;
    // IMPORTANT:
    // pinnedAt is a bump ACTION.
    // It must ALWAYS be sorted DESC with NULLS LAST,
    // otherwise bumped products will fall to the bottom.
    const pinnedOrdering: Prisma.ProductOrderByWithRelationInput[] = [
      {
        pinnedAt: {
          sort: 'desc',
          nulls: 'last',
        },
      },
    ];
    if (key === ProductManagementSortBy.views) {
      return [...pinnedOrdering, { viewsCount: direction }, { id: direction }];
    }
    if (key === ProductManagementSortBy.price) {
      return [...pinnedOrdering, { price: direction }, { id: direction }];
    }
    if (key === ProductManagementSortBy.updatedAt) {
      return [...pinnedOrdering, { updatedAt: direction }, { id: direction }];
    }
    if (key === ProductManagementSortBy.status) {
      return [...pinnedOrdering, { status: direction }, { id: direction }];
    }
    return [...pinnedOrdering, { createdAt: direction }, { id: direction }];
  }

  private normalizeCreateDto(
    scope: ProductManagementScope,
    dto: CreateProductDto | AdminProductCreateDto,
    actor: Actor,
  ): CreateProductDto {
    if (scope.type === 'owner') {
      return {
        ...dto,
        authorIds: [scope.ownerId],
      };
    }

    const ownerId = (dto as AdminProductCreateDto).ownerId;
    if (!ownerId) {
      return dto;
    }
    if (dto.authorIds && dto.authorIds.length > 0) {
      throw new BadRequestException('Provide either ownerId or authorIds, not both.');
    }
    if (!actor.isAdmin) {
      throw new ForbiddenException('Only admins may set ownerId.');
    }
    return {
      ...dto,
      authorIds: [ownerId],
    };
  }

  private async getManagedProduct(
    scope: ProductManagementScope,
    idOrSlug: string,
  ): Promise<ProductWithRelations> {
    const where = buildProductIdOrSlugWhere(idOrSlug);
    const finalWhere: Prisma.ProductWhereInput =
      scope.type === 'owner'
        ? {
            AND: [
              where,
              { supplierLinks: { some: { userId: scope.ownerId } } },
            ],
          }
        : where;
    const product = await this.prisma.product.findFirst({
      where: finalWhere,
      include: productInclude,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product as ProductWithRelations;
  }
}
