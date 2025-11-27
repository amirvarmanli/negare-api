import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, PrismaTxClient } from '@app/prisma/prisma.service';
import { CreateTagDto } from '@app/catalog/tags/dtos/tag-create.dto';
import { UpdateTagDto } from '@app/catalog/tags/dtos/tag-update.dto';
import { TagFindQueryDto } from '@app/catalog/tags/dtos/tag-query.dto';
import {
  TagDto,
  TagListResultDto,
} from '@app/catalog/tags/dtos/tag-response.dto';
import { TagMapper, TagWithCount } from '@app/catalog/tags/tag.mapper';

/* ============================================================
 * Helpers
 * ========================================================== */

/**
 * اسلاگیفای کردن رشته، سازگار با حروف یونیکد (از جمله فارسی).
 * مثال:
 *  "امیر حسین" → "امیر-حسین"
 *  "   امام! رضا 123 " → "امام-رضا-123"
 */
function slugify(s: string): string {
  return (
    s
      .toString()
      .trim()
      .toLowerCase()
      // فاصله‌ها → خط تیره
      .replace(/\s+/g, '-')
      // حذف هرچیزی غیر از حرف/عدد/خط‌تیره (با پشتیبانی Unicode)
      .replace(/[^-\p{L}\p{N}]+/gu, '')
      // خط‌تیره‌های پشت سر هم → یکی
      .replace(/-+/g, '-')
      // حذف خط‌تیره‌های اضافه ابتدا و انتها
      .replace(/^-+|-+$/g, '')
  );
}

function isBigIntStr(v?: string): v is string {
  return !!v && /^\d+$/.test(v);
}

function normalizeTagLabel(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+/g, ' ');
}

/* ============================================================
 * Service
 * ========================================================== */

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  /* -------- Create (idempotent روی slug) -------- */
  async create(dto: CreateTagDto): Promise<TagDto> {
    const name = normalizeTagLabel(dto.name);
    if (!name) {
      throw new BadRequestException('Tag name is required');
    }

    // اگر slug صریح ندادن، از name بساز
    const baseSlug = dto.slug?.trim() || slugify(name);

    if (!baseSlug) {
      // حالت خیلی نادر: مثلا فقط ایموجی یا کاراکترهای غیرمجاز داده شده
      throw new BadRequestException('Tag slug is invalid');
    }

    const slug = baseSlug;

    // ۱) اگر تگی با همین slug قبلاً وجود دارد، همان را برگردان (idempotent)
    const existing = await this.prisma.tag.findUnique({
      where: { slug },
      include: { _count: { select: { productLinks: true } } },
    });

    if (existing) {
      return TagMapper.toDto(existing as TagWithCount);
    }

    // ۲) اگر وجود ندارد، سعی کن ایجادش کنی
    try {
      const created = await this.prisma.tag.create({
        data: { name, slug },
        include: { _count: { select: { productLinks: true } } },
      });

      return TagMapper.toDto(created as TagWithCount);
    } catch (err: unknown) {
      // ۳) هندل کردن race condition: اگر دو درخواست همزمان همین slug را ساختند
      if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
        throw err;
      }
      if (err.code === 'P2002') {
        const row = await this.prisma.tag.findUnique({
          where: { slug },
          include: { _count: { select: { productLinks: true } } },
        });

        if (row) {
          return TagMapper.toDto(row as TagWithCount);
        }
      }

      throw err;
    }
  }

  /* -------- Update -------- */
  async update(idStr: string, dto: UpdateTagDto): Promise<TagDto> {
    if (!isBigIntStr(idStr)) {
      throw new BadRequestException('Invalid tag id');
    }

    const data: Prisma.TagUpdateInput = {
      name: dto.name ? normalizeTagLabel(dto.name) : undefined,
      slug: dto.slug?.trim() ?? undefined,
    };

    const updated = await this.prisma.tag.update({
      where: { id: BigInt(idStr) },
      data,
      include: { _count: { select: { productLinks: true } } },
    });

    return TagMapper.toDto(updated as TagWithCount);
  }

  /* -------- Find One (by id or slug) -------- */
  async findOne(idOrSlug: string): Promise<TagDto> {
    const where: Prisma.TagWhereUniqueInput = isBigIntStr(idOrSlug)
      ? { id: BigInt(idOrSlug) }
      : { slug: idOrSlug };

    const row = await this.prisma.tag.findUnique({
      where,
      include: { _count: { select: { productLinks: true } } },
    });

    if (!row) {
      throw new NotFoundException('Tag not found');
    }

    return TagMapper.toDto(row as TagWithCount);
  }

  /* -------- List (flat) -------- */
  async findAll(q: TagFindQueryDto): Promise<TagListResultDto> {
    const limit = Math.min(Math.max(q.limit ?? 100, 1), 200);

    const ands: Prisma.TagWhereInput[] = [];

    if (q.q?.trim()) {
      const term = normalizeTagLabel(q.q);
      if (term) {
      ands.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
        ],
      });
      }
    }

    if (q.usedOnly === 'true') {
      ands.push({ productLinks: { some: {} } });
    }

    const where: Prisma.TagWhereInput = ands.length ? { AND: ands } : {};

    const rows = await this.prisma.tag.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      take: limit,
      include: { _count: { select: { productLinks: true } } },
    });

    return {
      items: rows.map((r: TagWithCount) => TagMapper.toDto(r as TagWithCount)),
    };
  }

  /* -------- Popular (by usage count) -------- */
  async popular(limit = 20): Promise<TagListResultDto> {
    const take = Math.min(Math.max(limit, 1), 100);

    const rows = await this.prisma.tag.findMany({
      orderBy: [
        { productLinks: { _count: 'desc' } }, // پرمصرف‌ترها
        { name: 'asc' },
      ],
      take,
      include: { _count: { select: { productLinks: true } } },
    });

    return {
      items: rows.map((r: TagWithCount) => TagMapper.toDto(r as TagWithCount)),
    };
  }

  /* -------- Remove -------- */
  async remove(idStr: string): Promise<void> {
    if (!isBigIntStr(idStr)) {
      throw new BadRequestException('Invalid tag id');
    }

    await this.prisma.$transaction(async (trx: PrismaTxClient) => {
      await trx.productTag.deleteMany({ where: { tagId: BigInt(idStr) } });
      await trx.tag.delete({ where: { id: BigInt(idStr) } });
    });
  }
}
