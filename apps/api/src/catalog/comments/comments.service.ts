import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, PrismaTxClient } from '@app/prisma/prisma.service';
import { Prisma, CommentTarget } from '@prisma/client';
import { Buffer } from 'buffer';
import { clampPagination, toPaginationResult } from '@app/catalog/utils/pagination.util';
import { CreateCommentDto } from '@app/catalog/comments/dtos/comment-create.dto';
import { UpdateCommentDto } from '@app/catalog/comments/dtos/comment-update.dto';
import { CommentQueryDto } from '@app/catalog/comments/dtos/comment-query.dto';
import {
  CommentDto,
  CommentListDto,
  ProductCommentsResultDto,
} from '@app/catalog/comments/dtos/comment-response.dto';
import { ProductCommentQueryDto } from '@app/catalog/comments/dtos/product-comment-query.dto';

type CommentEntity = Prisma.CommentGetPayload<{}>;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCommentDto): Promise<CommentDto> {
    const productId = this.toBigIntNullable(dto.productId);
    const parentId = this.toBigIntNullable(dto.parentId);

    if (parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!parent) {
        throw new BadRequestException('Parent comment not found');
      }
    }

    const created = await this.prisma.comment.create({
      data: {
        userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        body: dto.body,
        productId: productId ?? null,
        parentId: parentId ?? null,
        isApproved: true,
      },
    });

    return this.toDto(created as CommentEntity);
  }

  async listModeration(query: CommentQueryDto): Promise<CommentListDto> {
    const { page, limit, skip } = clampPagination(query.page, query.limit, 200);
    const where: Prisma.CommentWhereInput = {};

    if (query.targetType) where.targetType = query.targetType as CommentTarget;
    if (query.targetId) where.targetId = query.targetId;
    if (query.productId) {
      const pid = this.toBigIntNullable(query.productId);
      if (pid) where.productId = pid;
    }
    if (query.isApproved) {
      where.isApproved = query.isApproved === 'true';
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    const pageData: CommentDto[] = rows.map((row: CommentEntity) =>
      this.toDto(row as CommentEntity),
    );
    const pagination = toPaginationResult(pageData, total, page, limit);

    return {
      items: pagination.data,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      hasNext: pagination.hasNext,
    };
  }

  async listForProduct(
    productIdStr: string,
    query: ProductCommentQueryDto,
  ): Promise<ProductCommentsResultDto> {
    const productId = this.toBigIntNullable(productIdStr);
    if (!productId) {
      throw new BadRequestException('Invalid product id');
    }

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const cursor = this.decodeCursor(query.cursor);
    let cursorWhere: Prisma.CommentWhereInput | undefined;
    if (cursor) {
      const createdAt = new Date(cursor.createdAt);
      const id = BigInt(cursor.id);
      cursorWhere = {
        OR: [
          { createdAt: { lt: createdAt } },
          { AND: [{ createdAt }, { id: { lt: id } }] },
        ],
      };
    }

    const rows: CommentEntity[] = await this.prisma.comment.findMany({
      where: {
        AND: [
          { productId, isApproved: true },
          cursorWhere ?? {},
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    let nextCursor: string | undefined;
    if (rows.length === limit) {
      const last = rows[rows.length - 1];
      nextCursor = this.encodeCursor({
        createdAt: last.createdAt.toISOString(),
        id: String(last.id),
      });
    }

    return {
      items: rows.map((row: CommentEntity) => this.toDto(row as CommentEntity)),
      nextCursor,
    };
  }

  async update(idStr: string, dto: UpdateCommentDto): Promise<CommentDto> {
    const id = this.toBigIntOrThrow(idStr);
    const updated = await this.prisma.comment.update({
      where: { id },
      data: {
        body: dto.body ?? undefined,
        isApproved: dto.isApproved ?? undefined,
      },
    });
    return this.toDto(updated as CommentEntity);
  }

  async remove(idStr: string): Promise<void> {
    const id = this.toBigIntOrThrow(idStr);
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Comment not found');
    }
    await this.prisma.$transaction(async (trx: PrismaTxClient) => {
      await trx.comment.deleteMany({ where: { parentId: id } });
      await trx.comment.delete({ where: { id } });
    });
  }

  private toDto(row: CommentEntity): CommentDto {
    return {
      id: String(row.id),
      userId: row.userId,
      body: row.body,
      isApproved: row.isApproved ?? false,
      targetType: row.targetType as CommentTarget,
      targetId: row.targetId,
      productId: row.productId ? String(row.productId) : undefined,
      parentId: row.parentId ? String(row.parentId) : undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private encodeCursor(obj: Record<string, string>): string {
    return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  }

  private decodeCursor(
    cursor?: string,
  ): { createdAt: string; id: string } | undefined {
    if (!cursor) return undefined;
    try {
      return JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as { createdAt: string; id: string };
    } catch {
      return undefined;
    }
  }

  private toBigIntOrThrow(id: string): bigint {
    if (!/^\d+$/u.test(id)) {
      throw new BadRequestException('Invalid comment id');
    }
    return BigInt(id);
  }

  private toBigIntNullable(value?: string): bigint | null {
    if (!value || !/^\d+$/u.test(value)) return null;
    return BigInt(value);
  }
}
