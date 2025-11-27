import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, PrismaTxClient } from '@app/prisma/prisma.service';
import {
  clampFaSlug,
  makeFaSlug,
  normalizeFaText,
} from '@shared-slug/slug/fa-slug.util';
import { CreateCategoryDto } from '@app/catalog/categories/dtos/category-create.dto';
import { UpdateCategoryDto } from '@app/catalog/categories/dtos/category-update.dto';
import { CategoryFindQueryDto } from '@app/catalog/categories/dtos/category-query.dto';
import {
  CategoryBreadcrumbDto,
  CategoryDto,
  CategoryListResultDto,
  CategoryTreeNodeDto,
} from '@app/catalog/categories/dtos/category-response.dto';
import {
  CategoryEntity,
  CategoryMapper,
} from '@app/catalog/categories/category.mapper';

function toBigIntNullable(id?: string): bigint | null {
  if (!id || !/^\d+$/.test(id)) return null;
  return BigInt(id);
}

const CATEGORY_ENTITY_TYPE = 'category' as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------------- Create ---------------- */
  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const parentId = toBigIntNullable(dto.parentId);
    const name = normalizeFaText(dto.name);
    const slug = await this.ensureUniqueSlug(dto.slug ?? dto.name);
    const created = await this.prisma.category.create({
      data: {
        name,
        slug,
        parentId: parentId ?? null,
        coverUrl: dto.coverUrl ?? null,
      },
    });
    return CategoryMapper.toDto(created);
  }

  /* ---------------- Update ---------------- */
  async update(idStr: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const id = toBigIntNullable(idStr);
    if (!id) throw new BadRequestException('Invalid category id');

    const existing = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const nextName =
      dto.name !== undefined ? normalizeFaText(dto.name) : undefined;
    const slugSource =
      dto.slug !== undefined
        ? dto.slug
        : dto.name !== undefined
          ? dto.name
          : undefined;
    const nextSlug = slugSource
      ? await this.ensureUniqueSlug(slugSource, id)
      : undefined;

    // parentId رفتار: undefined = دست نزن | '' یا null = detach | مقدار = connect
    const data: Prisma.CategoryUpdateInput = {
      name: nextName ?? undefined,
      slug: nextSlug ?? undefined,
      coverUrl: dto.coverUrl ?? undefined,
      ...(dto.parentId === undefined
        ? {}
        : dto.parentId && /^\d+$/.test(dto.parentId)
          ? { parent: { connect: { id: BigInt(dto.parentId) } } }
          : { parent: { disconnect: true } }),
    };

    const updated = await this.prisma.$transaction(
      async (trx: PrismaTxClient) => {
        const result = await trx.category.update({
          where: { id },
          data,
        });
        if (nextSlug && nextSlug !== existing.slug) {
          await this.createSlugRedirect(trx, id, existing.slug, nextSlug);
        }
        return result;
      },
    );
    return CategoryMapper.toDto(updated);
  }

  /* ---------------- Find One ---------------- */
  async findById(idStr: string): Promise<CategoryDto> {
    const id = toBigIntNullable(idStr);
    if (!id) {
      throw new BadRequestException('Invalid category id');
    }
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return CategoryMapper.toDto(category);
  }

  async findBySlug(
    slug: string,
  ): Promise<{ category?: CategoryDto; redirectTo?: string }> {
    const direct = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (direct) {
      return { category: CategoryMapper.toDto(direct) };
    }
    const redirect = await this.prisma.slugRedirect.findUnique({
      where: { fromSlug: slug },
      select: { entityType: true, toSlug: true },
    });
    if (redirect?.entityType === CATEGORY_ENTITY_TYPE) {
      return { redirectTo: redirect.toSlug };
    }
    throw new NotFoundException('Category not found');
  }

  /* ---------------- List (flat) ---------------- */
  async findAll(q: CategoryFindQueryDto): Promise<CategoryListResultDto> {
    const limit = Math.min(Math.max(q.limit ?? 100, 1), 200);
    const ands: Prisma.CategoryWhereInput[] = [];

    if (q.q?.trim()) {
      const term = normalizeFaText(q.q.trim());
      ands.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
    if (q.parentId !== undefined) {
      const pid = toBigIntNullable(q.parentId);
      ands.push({ parentId: pid ?? null });
    }

    const where: Prisma.CategoryWhereInput = ands.length ? { AND: ands } : {};
    const rows = await this.prisma.category.findMany({
      where,
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      take: limit,
    });

    return { items: rows.map(CategoryMapper.toDto) };
  }

  /* ---------------- Tree (rooted) ---------------- */
  async tree(rootIdStr?: string): Promise<CategoryTreeNodeDto[]> {
    // همه را یکجا می‌کشیم (برای N <= چند هزار OK). اگر دیتاست بزرگ شد، باید lazy-load یا CTE بیاوری.
    const rows = await this.prisma.category.findMany({
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
    const nodes: CategoryTreeNodeDto[] = rows.map((r: CategoryEntity) =>
      CategoryMapper.toTreeNode(r, []),
    );
    const byId = new Map<string, CategoryTreeNodeDto>();
    nodes.forEach((n: CategoryTreeNodeDto) => byId.set(n.id, n));

    // ساخت درخت
    const roots: CategoryTreeNodeDto[] = [];
    nodes.forEach((n: CategoryTreeNodeDto) => {
      const parentId = rows.find(
        (r: CategoryEntity) => String(r.id) === n.id,
      )?.parentId;
      const pkey = parentId ? String(parentId) : null;
      if (!pkey) {
        roots.push(n);
      } else {
        const parent = byId.get(pkey);
        if (parent) parent.children.push(n);
      }
    });

    if (rootIdStr && /^\d+$/.test(rootIdStr)) {
      const root = byId.get(rootIdStr);
      return root ? [root] : [];
    }
    return roots;
  }

  /* ---------------- Breadcrumbs (root..self) ---------------- */
  async breadcrumbs(idStr: string): Promise<CategoryBreadcrumbDto> {
    const id = toBigIntNullable(idStr);
    if (!id) throw new BadRequestException('Invalid category id');

    const path: CategoryEntity[] = [];
    let current = await this.prisma.category.findUnique({ where: { id } });
    while (current) {
      path.push(current);
      if (!current.parentId) break;
      current = await this.prisma.category.findUnique({
        where: { id: current.parentId },
      });
    }
    path.reverse();
    return { path: path.map(CategoryMapper.toDto) };
  }

  /* ---------------- Remove (hard) ----------------
   * اگر Soft-delete می‌خواهی، فیلد status/active اضافه کن و update کن.
   * اینجا hard-delete با انتقال فرزندان به parentِ خودِ این گره (در صورت وجود).
   * ---------------------------------------------- */
  async remove(idStr: string): Promise<void> {
    const id = toBigIntNullable(idStr);
    if (!id) throw new BadRequestException('Invalid category id');

    const node = await this.prisma.category.findUnique({ where: { id } });
    if (!node) throw new NotFoundException('Category not found');

    await this.prisma.$transaction(async (trx: PrismaTxClient) => {
      // فرزندان را به والد این گره منتقل کن (یا root کن)
      await trx.category.updateMany({
        where: { parentId: id },
        data: { parentId: node.parentId ?? null },
      });

      // لینک‌های محصول را حذف کن (در صورت نیاز می‌تونی به دسته‌ی والد منتقل کنی)
      await trx.productCategory.deleteMany({ where: { categoryId: id } });
      await trx.slugRedirect.deleteMany({
        where: {
          entityType: CATEGORY_ENTITY_TYPE,
          entityId: id.toString(),
        },
      });

      await trx.category.delete({ where: { id } });
    });
  }

  private async ensureUniqueSlug(
    source: string,
    ignoreId?: bigint,
  ): Promise<string> {
    const base = makeFaSlug(source);
    if (!base) {
      throw new BadRequestException('Slug cannot be resolved from name.');
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate =
        attempt === 0 ? base : clampFaSlug(`${base}-${attempt + 1}`);
      const existing = await this.prisma.category.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || (ignoreId && existing.id === ignoreId)) {
        return candidate;
      }
    }
    return clampFaSlug(`${base}-${Date.now()}`);
  }

  private async createSlugRedirect(
    trx: PrismaTxClient,
    entityId: bigint,
    fromSlug: string,
    toSlug: string,
  ): Promise<void> {
    if (fromSlug === toSlug) {
      return;
    }
    try {
      await trx.slugRedirect.create({
        data: {
          entityType: CATEGORY_ENTITY_TYPE,
          entityId: entityId.toString(),
          fromSlug,
          toSlug,
        },
      });
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        throw error;
      }
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `A redirect already exists for slug "${fromSlug}"`,
        );
      }
      throw error;
    }
  }
}
