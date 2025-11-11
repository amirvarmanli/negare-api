import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  clampFaSlug,
  makeFaSlug,
  normalizeFaText,
} from '@shared-slug/slug/fa-slug.util';
import { CreateTopicDto } from '@app/catalog/topics/dtos/topic-create.dto';
import { UpdateTopicDto } from '@app/catalog/topics/dtos/topic-update.dto';
import { TopicQueryDto } from '@app/catalog/topics/dtos/topic-query.dto';
import { TopicDto, TopicListDto } from '@app/catalog/topics/dtos/topic-response.dto';
import { TopicMapper, TopicWithCount } from '@app/catalog/topics/topic.mapper';

const TOPIC_ENTITY_TYPE = 'topic' as const;

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTopicDto): Promise<TopicDto> {
    const name = normalizeFaText(dto.name);
    const slug = await this.ensureUniqueSlug(dto.slug ?? dto.name);
    const created = await this.prisma.topic.create({
      data: {
        name,
        slug,
        coverUrl: dto.coverUrl ?? null,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
      },
      include: { _count: { select: { productLinks: true } } },
    });
    return TopicMapper.toDto(created as TopicWithCount);
  }

  async update(idStr: string, dto: UpdateTopicDto): Promise<TopicDto> {
    const id = this.toBigIntOrThrow(idStr);
    const existing = await this.prisma.topic.findUnique({
      where: { id },
      include: { _count: { select: { productLinks: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Topic not found');
    }

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

    const updated = await this.prisma.$transaction(async (trx) => {
      const result = await trx.topic.update({
        where: { id },
        data: {
          name: nextName ?? undefined,
          slug: nextSlug ?? undefined,
          coverUrl: dto.coverUrl ?? undefined,
          seoTitle: dto.seoTitle ?? undefined,
          seoDescription: dto.seoDescription ?? undefined,
        },
        include: { _count: { select: { productLinks: true } } },
      });
      if (nextSlug && nextSlug !== existing.slug) {
        await this.createSlugRedirect(trx, id, existing.slug, nextSlug);
      }
      return result;
    });
    return TopicMapper.toDto(updated as TopicWithCount);
  }

  async findById(idStr: string): Promise<TopicDto> {
    const id = this.toBigIntOrThrow(idStr);
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: { _count: { select: { productLinks: true } } },
    });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    return TopicMapper.toDto(topic as TopicWithCount);
  }

  async findBySlug(
    slug: string,
  ): Promise<{ topic?: TopicDto; redirectTo?: string }> {
    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      include: { _count: { select: { productLinks: true } } },
    });
    if (topic) {
      return { topic: TopicMapper.toDto(topic as TopicWithCount) };
    }
    const redirect = await this.prisma.slugRedirect.findUnique({
      where: { fromSlug: slug },
      select: { entityType: true, toSlug: true },
    });
    if (redirect?.entityType === TOPIC_ENTITY_TYPE) {
      return { redirectTo: redirect.toSlug };
    }
    throw new NotFoundException('Topic not found');
  }

  async findAll(query: TopicQueryDto): Promise<TopicListDto> {
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 200);
    const ands: Prisma.TopicWhereInput[] = [];
    if (query.q?.trim()) {
      const term = normalizeFaText(query.q.trim());
      ands.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    const rows = await this.prisma.topic.findMany({
      where: ands.length ? { AND: ands } : undefined,
      orderBy: [{ name: 'asc' }],
      take: limit,
      include: { _count: { select: { productLinks: true } } },
    });

    return {
      items: rows.map((topic) => TopicMapper.toDto(topic as TopicWithCount)),
    };
  }

  async remove(idStr: string): Promise<void> {
    const id = this.toBigIntOrThrow(idStr);
    const existing = await this.prisma.topic.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Topic not found');
    }
    await this.prisma.$transaction(async (trx) => {
      await trx.productTopic.deleteMany({ where: { topicId: id } });
      await trx.slugRedirect.deleteMany({
        where: {
          entityType: TOPIC_ENTITY_TYPE,
          entityId: id.toString(),
        },
      });
      await trx.topic.delete({ where: { id } });
    });
  }

  private toBigIntOrThrow(id: string): bigint {
    if (!/^\d+$/u.test(id)) {
      throw new BadRequestException('Topic id must be numeric');
    }
    return BigInt(id);
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
      const existing = await this.prisma.topic.findUnique({
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
    trx: Prisma.TransactionClient,
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
          entityType: TOPIC_ENTITY_TYPE,
          entityId: entityId.toString(),
          fromSlug,
          toSlug,
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `A redirect already exists for slug "${fromSlug}"`,
        );
      }
      throw error;
    }
  }
}
