import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommentStatus,
  NewsletterCategory,
  Prisma,
  PublicationStatus,
  RoleName,
} from '@prisma/client';
import { PrismaService, PrismaTxClient } from '@app/prisma/prisma.service';
import { buildPaginationMeta } from '@app/common/dto/pagination.dto';
import { createSlug } from '@app/shared/utils/slug.util';
import {
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { CreateNewsletterIssueDto } from '@app/newsletter/dto/create-newsletter-issue.dto';
import { UpdateNewsletterIssueDto } from '@app/newsletter/dto/update-newsletter-issue.dto';
import {
  NewsletterIssuesQueryDto,
  NewsletterAdminIssuesQueryDto,
} from '@app/newsletter/dto/newsletter-issues-query.dto';
import {
  NewsletterIssueDto,
  NewsletterIssueListResponseDto,
} from '@app/newsletter/dto/newsletter-issue.dto';
import {
  NewsletterCategoryDto,
  NewsletterCategoryListResponseDto,
} from '@app/newsletter/dto/newsletter-category.dto';
import { CreateNewsletterCategoryDto } from '@app/newsletter/dto/create-newsletter-category.dto';
import { UpdateNewsletterCategoryDto } from '@app/newsletter/dto/update-newsletter-category.dto';
import { CreateNewsletterCommentDto } from '@app/newsletter/dto/create-newsletter-comment.dto';
import {
  NewsletterCommentDto,
  NewsletterCommentListResponseDto,
} from '@app/newsletter/dto/newsletter-comment.dto';
import {
  NewsletterCommentsQueryDto,
  NewsletterAdminCommentsQueryDto,
} from '@app/newsletter/dto/newsletter-comments-query.dto';
import { UpdateNewsletterCommentStatusDto } from '@app/newsletter/dto/update-newsletter-comment-status.dto';
import { UpdateNewsletterPinStatusDto } from '@app/newsletter/dto/update-newsletter-pin-status.dto';
import { query } from 'express';

const AUTHOR_SUMMARY_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
} as const;

const ISSUE_SUMMARY_SELECT = {
  id: true,
  title: true,
  slug: true,
} as const;

type NewsletterIssueWithRelations = Prisma.NewsletterIssueGetPayload<{
  include: {
    category: true;
    author: { select: typeof AUTHOR_SUMMARY_SELECT };
    _count: { select: { comments: true } };
  };
}>;

type NewsletterIssueWithComments = Prisma.NewsletterIssueGetPayload<{
  include: {
    category: true;
    author: { select: typeof AUTHOR_SUMMARY_SELECT };
    _count: { select: { comments: true } };
    comments: {
      include: {
        author: { select: typeof AUTHOR_SUMMARY_SELECT };
        replies: {
          include: {
            author: { select: typeof AUTHOR_SUMMARY_SELECT };
          };
        };
      };
    };
  };
}>;

type NewsletterCommentBase = Prisma.NewsletterCommentGetPayload<{
  include: {
    author: { select: typeof AUTHOR_SUMMARY_SELECT };
  };
}>;

type NewsletterCommentWithRelations = NewsletterCommentBase & {
  issue?: { id: string; title: string; slug: string };
  replies?: NewsletterCommentWithRelations[];
};

@Injectable()
export class NewsletterService {
  private readonly defaultLimit = 10;
  private readonly maxLimit = 50;

  constructor(private readonly prisma: PrismaService) {}

  async listPublicIssues(
    query: NewsletterIssuesQueryDto,
  ): Promise<NewsletterIssueListResponseDto> {
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
    );

    const now = new Date();
    const where: Prisma.NewsletterIssueWhereInput = {
      deletedAt: null,
      status: PublicationStatus.PUBLISHED,
      category: query.categorySlug
        ? { is: { slug: query.categorySlug, isActive: true } }
        : undefined,
    };

    if (query.supplierId) {
      where.authorId = query.supplierId;
    }

    this.ensurePublicPublicationClause(where, now);

    this.applySearchFilters(where, query.q);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.newsletterIssue.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isPinned: 'desc' },
          { isFeatured: 'desc' },
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          category: true,
          author: { select: AUTHOR_SUMMARY_SELECT },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.newsletterIssue.count({ where }),
    ]);

    return {
      items: items.map((issue) => this.toIssueDto(issue)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async listIssuesByCategorySlug(
    categorySlug: string,
    query: NewsletterIssuesQueryDto,
  ): Promise<NewsletterIssueListResponseDto> {
    const category = await this.prisma.newsletterCategory.findFirst({
      where: { slug: categorySlug, isActive: true },
    });
    if (!category) {
      throw new NotFoundException('Newsletter category not found');
    }

    return this.listPublicIssues({
      ...query,
      categorySlug,
    });
  }

  async getIssueBySlug(slug: string): Promise<NewsletterIssueDto> {
    const now = new Date();
    const issue = await this.prisma.newsletterIssue.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: PublicationStatus.PUBLISHED,
        OR: [
          { publishedAt: { lte: now } },
          { publishedAt: null },
        ],
      },
      include: {
        category: true,
        author: { select: AUTHOR_SUMMARY_SELECT },
        _count: { select: { comments: true } },
        comments: {
          where: {
            status: CommentStatus.APPROVED,
            parentId: null,
          },
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: AUTHOR_SUMMARY_SELECT },
            replies: {
              where: { status: CommentStatus.APPROVED },
              orderBy: { createdAt: 'asc' },
              include: {
                author: { select: AUTHOR_SUMMARY_SELECT },
              },
            },
          },
        },
      },
    });

    if (!issue) {
      console.log('fetchAdminIssue not found', { query });
      throw new NotFoundException('Newsletter issue not found');
    }

    const dto = this.toIssueDto(issue as NewsletterIssueWithComments);
    dto.comments = issue.comments.map((comment) =>
      this.toCommentDto(comment as NewsletterCommentWithRelations, {
        includeReplies: true,
      }),
    );
    return dto;
  }

  async findAdminNewsletterIssueById(
    id: string,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<NewsletterIssueDto> {
    const authenticatedUser = this.assertAuthenticated(currentUser);
    return this.fetchAdminIssue({ id }, authenticatedUser);
  }

  async findAdminNewsletterIssueBySlug(
    slug: string,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<NewsletterIssueDto> {
    const authenticatedUser = this.assertAuthenticated(currentUser);
    return this.fetchAdminIssue({ slug }, authenticatedUser);
  }

  async listIssueComments(
    slug: string,
    query: NewsletterCommentsQueryDto,
  ): Promise<NewsletterCommentListResponseDto> {
    const issue = await this.prisma.newsletterIssue.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!issue) {
      throw new NotFoundException('Newsletter issue not found');
    }

    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
    );

    const where: Prisma.NewsletterCommentWhereInput = {
      issueId: issue.id,
      status: CommentStatus.APPROVED,
      parentId: null,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.newsletterComment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: AUTHOR_SUMMARY_SELECT },
          replies: {
            where: { status: CommentStatus.APPROVED },
            orderBy: { createdAt: 'asc' },
            include: { author: { select: AUTHOR_SUMMARY_SELECT } },
          },
        },
      }),
      this.prisma.newsletterComment.count({ where }),
    ]);

    return {
      items: items.map((item) =>
        this.toCommentDto(item as NewsletterCommentWithRelations, {
          includeReplies: true,
        }),
      ),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async listCategories(): Promise<NewsletterCategoryListResponseDto> {
    return this.buildCategoryList({ isActive: true });
  }

  async listAllCategories(): Promise<NewsletterCategoryListResponseDto> {
    return this.buildCategoryList({});
  }

  async createIssue(
    dto: CreateNewsletterIssueDto,
    authorId: string,
  ): Promise<NewsletterIssueDto> {
    await this.ensureCategoryExists(dto.categoryId);
    const slug = await this.ensureUniqueIssueSlug(
      createSlug(dto.slug ?? dto.title),
    );
    const status = dto.status ?? PublicationStatus.DRAFT;
    const publishedAt = this.resolvePublishedAt(status, dto.publishedAt);

    const issue = await this.prisma.$transaction(async (tx) => {
      if (dto.isPinned) {
        await this.unpinOtherNewsletterIssues(tx);
      }

      return tx.newsletterIssue.create({
        data: {
          title: dto.title,
          slug,
          content: dto.content,
          excerpt: dto.excerpt,
          coverImageUrl: dto.coverImageUrl,
          fileUrl: dto.fileUrl,
          status,
          publishedAt,
          categoryId: dto.categoryId,
          authorId,
          isFeatured: dto.isFeatured ?? false,
          isPinned: dto.isPinned ?? false,
        },
        include: {
          category: true,
          author: { select: AUTHOR_SUMMARY_SELECT },
          _count: { select: { comments: true } },
        },
      });
    });

    return this.toIssueDto(issue);
  }

  async updateIssue(
    id: string,
    dto: UpdateNewsletterIssueDto,
    currentUser: CurrentUserPayload,
  ): Promise<NewsletterIssueDto> {
    const authenticatedUser = this.assertAuthenticated(currentUser);
    const existing = await this.prisma.newsletterIssue.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        authorId: true,
        status: true,
        publishedAt: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Newsletter issue not found');
    }

    this.ensureOwnership(existing.authorId, authenticatedUser);

    const data: Prisma.NewsletterIssueUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.coverImageUrl !== undefined)
      data.coverImageUrl = dto.coverImageUrl;
    if (dto.fileUrl !== undefined) data.fileUrl = dto.fileUrl;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.publishedAt !== undefined) data.publishedAt = dto.publishedAt;
    if (dto.isFeatured !== undefined) data.isFeatured = dto.isFeatured;
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
      data.category = { connect: { id: dto.categoryId } };
    }
    if (dto.authorId) {
      await this.ensureUserExists(dto.authorId);
      data.author = { connect: { id: dto.authorId } };
    }

    if (dto.slug) {
      data.slug = await this.ensureUniqueIssueSlug(createSlug(dto.slug), id);
    }

    const newStatus = dto.status ?? existing.status;
    if (dto.publishedAt !== undefined) {
      data.publishedAt = dto.publishedAt;
    } else if (
      newStatus === PublicationStatus.PUBLISHED &&
      existing.status !== PublicationStatus.PUBLISHED &&
      !existing.publishedAt
    ) {
      data.publishedAt = new Date();
    }

    const issue = await this.prisma.$transaction(async (tx) => {
      if (dto.isPinned === true) {
        await this.unpinOtherNewsletterIssues(tx, id);
      }

      return tx.newsletterIssue.update({
        where: { id },
        data,
        include: {
          category: true,
          author: { select: AUTHOR_SUMMARY_SELECT },
          _count: { select: { comments: true } },
        },
      });
    });

    return this.toIssueDto(issue);
  }

  async softDeleteIssue(
    id: string,
    currentUser: CurrentUserPayload,
  ): Promise<void> {
    const authenticatedUser = this.assertAuthenticated(currentUser);
    const existing = await this.prisma.newsletterIssue.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true },
    });
    if (!existing) {
      throw new NotFoundException('Newsletter issue not found');
    }

    this.ensureOwnership(existing.authorId, authenticatedUser);

    await this.prisma.newsletterIssue.update({
      where: { id },
      data: {
        status: PublicationStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });
  }

  async adminListIssues(
    query: NewsletterAdminIssuesQueryDto,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<NewsletterIssueListResponseDto> {
    const authenticatedUser = this.assertAuthenticated(currentUser);
    const isAdmin = this.isAdmin(authenticatedUser);
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
    );

    const where: Prisma.NewsletterIssueWhereInput = {
      deletedAt: null,
      status: query.status,
      categoryId: query.categoryId,
      category: query.categorySlug
        ? { is: { slug: query.categorySlug } }
        : undefined,
    };

    if (isAdmin) {
      if (query.authorId) {
        where.authorId = query.authorId;
      }
    } else {
      where.authorId = this.resolveOwnerId(authenticatedUser);
    }

    this.applySearchFilters(where, query.q);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.newsletterIssue.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          category: true,
          author: { select: AUTHOR_SUMMARY_SELECT },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.newsletterIssue.count({ where }),
    ]);

    return {
      items: items.map((issue) => this.toIssueDto(issue)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  private async fetchAdminIssue(
    where: Prisma.NewsletterIssueWhereInput,
    currentUser: CurrentUserPayload,
  ): Promise<NewsletterIssueDto> {
    const isAdmin = this.isAdmin(currentUser);
    const ownerId = this.resolveOwnerId(currentUser);
    const query: Prisma.NewsletterIssueWhereInput = {
      ...where,
      deletedAt: null,
      ...(isAdmin ? undefined : { authorId: ownerId }),
    };
    console.log('fetchAdminIssue', { isAdmin, ownerId, where: query });

    const issue = await this.prisma.newsletterIssue.findFirst({
      where: query,
      include: {
        category: true,
        author: { select: AUTHOR_SUMMARY_SELECT },
        _count: { select: { comments: true } },
      },
    });

    if (!issue) {
      throw new NotFoundException('Newsletter issue not found');
    }

    return this.toIssueDto(issue as NewsletterIssueWithRelations);
  }

  async updateIssuePinStatus(
    id: string,
    dto: UpdateNewsletterPinStatusDto,
  ): Promise<NewsletterIssueDto> {
    const issue = await this.prisma.$transaction(async (tx) => {
      if (dto.isPinned) {
        await this.unpinOtherNewsletterIssues(tx, id);
      }

      return tx.newsletterIssue.update({
        where: { id },
        data: { isPinned: dto.isPinned },
        include: {
          category: true,
          author: { select: AUTHOR_SUMMARY_SELECT },
          _count: { select: { comments: true } },
        },
      });
    });

    return this.toIssueDto(issue);
  }

  async createComment(
    issueId: string,
    dto: CreateNewsletterCommentDto,
    authorId: string,
  ): Promise<NewsletterCommentDto> {
    await this.ensureIssueExists(issueId);
    if (dto.parentId) {
      await this.ensureCommentOnIssue(dto.parentId, issueId);
    }

    const comment = await this.prisma.newsletterComment.create({
      data: {
        issueId,
        authorId,
        content: dto.content,
        parentId: dto.parentId ?? null,
      },
      include: {
        author: { select: AUTHOR_SUMMARY_SELECT },
      },
    });

    return this.toCommentDto(comment as NewsletterCommentWithRelations);
  }

  async adminListComments(
    query: NewsletterAdminCommentsQueryDto,
  ): Promise<NewsletterCommentListResponseDto> {
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
    );

    const where: Prisma.NewsletterCommentWhereInput = {
      status: query.status,
      issueId: query.issueId,
      content: query.q
        ? { contains: query.q.trim(), mode: 'insensitive' }
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.newsletterComment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: AUTHOR_SUMMARY_SELECT },
          issue: { select: ISSUE_SUMMARY_SELECT },
        },
      }),
      this.prisma.newsletterComment.count({ where }),
    ]);

    return {
      items: items.map((comment) =>
        this.toCommentDto(comment as NewsletterCommentWithRelations, {
          includeIssue: true,
        }),
      ),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async updateCommentStatus(
    id: string,
    dto: UpdateNewsletterCommentStatusDto,
  ): Promise<NewsletterCommentDto> {
    try {
      const comment = await this.prisma.newsletterComment.update({
        where: { id },
        data: { status: dto.status },
        include: {
          author: { select: AUTHOR_SUMMARY_SELECT },
          issue: { select: ISSUE_SUMMARY_SELECT },
        },
      });

      return this.toCommentDto(comment as NewsletterCommentWithRelations, {
        includeIssue: true,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Comment not found');
      }
      throw error;
    }
  }

  async createCategory(
    dto: CreateNewsletterCategoryDto,
  ): Promise<NewsletterCategoryDto> {
    if (dto.parentId) {
      await this.ensureCategoryExists(dto.parentId);
    }

    const slug = await this.ensureUniqueCategorySlug(
      createSlug(dto.slug ?? dto.name),
    );

    const category = await this.prisma.newsletterCategory.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        isActive: dto.isActive ?? true,
        parentId: dto.parentId ?? null,
      },
    });

    return this.toCategoryDto(category, 0);
  }

  async updateCategory(
    id: string,
    dto: UpdateNewsletterCategoryDto,
  ): Promise<NewsletterCategoryDto> {
    const existing = await this.prisma.newsletterCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Newsletter category not found');
    }

    if (dto.parentId && dto.parentId === id) {
      throw new BadRequestException('Category cannot parent itself');
    }

    if (dto.parentId) {
      await this.ensureCategoryExists(dto.parentId);
    }

    const data: Prisma.NewsletterCategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.parentId !== undefined) data.parent = dto.parentId
      ? { connect: { id: dto.parentId } }
      : { disconnect: true };

    if (dto.slug) {
      data.slug = await this.ensureUniqueCategorySlug(
        createSlug(dto.slug),
        id,
      );
    }

    const updated = await this.prisma.newsletterCategory.update({
      where: { id },
      data,
    });

    const issueCount = await this.prisma.newsletterIssue.count({
      where: {
        categoryId: id,
        status: PublicationStatus.PUBLISHED,
        deletedAt: null,
      },
    });

    return this.toCategoryDto(updated, issueCount);
  }

  async deleteCategory(id: string): Promise<void> {
    const existing = await this.prisma.newsletterCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Newsletter category not found');
    }

    await this.prisma.newsletterCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private resolvePagination(
    page?: number,
    limit?: number,
  ): { page: number; limit: number; skip: number } {
    const safePage = page && page > 0 ? page : 1;
    const safeLimit =
      limit && limit > 0
        ? Math.min(limit, this.maxLimit)
        : this.defaultLimit;
    const skip = (safePage - 1) * safeLimit;
    return { page: safePage, limit: safeLimit, skip };
  }

  private resolvePublishedAt(
    status: PublicationStatus,
    provided?: string | Date | null,
  ): Date | string | null {
    if (provided !== undefined) {
      return provided;
    }
    if (status === PublicationStatus.PUBLISHED) {
      return new Date();
    }
    return null;
  }

  private ensurePublicPublicationClause(
    where: Prisma.NewsletterIssueWhereInput,
    now: Date,
  ): void {
    this.addAndClause(where, {
      OR: [
        { publishedAt: { lte: now } },
        { publishedAt: null },
      ],
    });
  }

  private addAndClause(
    where: Prisma.NewsletterIssueWhereInput,
    clause: Prisma.NewsletterIssueWhereInput,
  ): void {
    const existing = where.AND;
    if (!existing) {
      where.AND = [clause];
      return;
    }
    where.AND = Array.isArray(existing)
      ? [...existing, clause]
      : [existing, clause];
  }

  private applySearchFilters(
    where: Prisma.NewsletterIssueWhereInput,
    query?: string,
  ): void {
    if (!query) {
      return;
    }
    const search = query.trim();
    if (!search) {
      return;
    }

    const clause: Prisma.NewsletterIssueWhereInput = {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ],
    };

    this.addAndClause(where, clause);
  }

  private assertAuthenticated(
    user?: CurrentUserPayload | undefined,
  ): CurrentUserPayload {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    return user;
  }

  private isAdmin(user: CurrentUserPayload): boolean {
    return Boolean(user.roles?.includes(RoleName.admin));
  }

  private ensureOwnership(
    authorId: string,
    user: CurrentUserPayload,
  ): void {
    const ownerId = this.resolveOwnerId(user);
    if (!this.isAdmin(user) && authorId !== ownerId) {
      throw new ForbiddenException('Not authorized to modify this issue');
    }
  }

  private resolveOwnerId(user: CurrentUserPayload): string {
    return user.id;
  }

  private toIssueDto(issue: NewsletterIssueWithRelations): NewsletterIssueDto {
    return {
      id: issue.id,
      title: issue.title,
      slug: issue.slug,
      summary: issue.excerpt,
      excerpt: issue.excerpt,
      content: issue.content,
      coverImageUrl: issue.coverImageUrl,
      status: issue.status,
      publishedAt: issue.publishedAt,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      viewCount: issue.viewCount,
      isFeatured: issue.isFeatured,
      isPinned: issue.isPinned,
      commentCount: issue._count?.comments ?? 0,
      fileUrl: issue.fileUrl ?? null,
      category: this.toCategoryDto(issue.category, 0),
      author: {
        id: issue.author.id,
        name: issue.author.name,
        avatarUrl: issue.author.avatarUrl,
      },
    };
  }

  private toCommentDto(
    comment: NewsletterCommentWithRelations,
    options?: { includeReplies?: boolean; includeIssue?: boolean },
  ): NewsletterCommentDto {
    const dto: NewsletterCommentDto = {
      id: comment.id,
      content: comment.content,
      status: comment.status,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: {
        id: comment.author.id,
        name: comment.author.name,
        avatarUrl: comment.author.avatarUrl,
      },
    };

    if (options?.includeIssue && comment.issue) {
      dto.issue = {
        id: comment.issue.id,
        title: comment.issue.title,
        slug: comment.issue.slug,
      };
    }

    if (options?.includeReplies && comment.replies) {
      dto.replies = comment.replies.map((reply) =>
        this.toCommentDto(reply as NewsletterCommentWithRelations, {
          includeReplies: false,
        }),
      );
    }

    return dto;
  }

  private toCategoryDto(
    category: NewsletterCategory,
    issueCount: number,
  ): NewsletterCategoryDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
      isActive: category.isActive,
      parentId: category.parentId ?? null,
      issueCount,
    };
  }

  private async buildCategoryList(
    where: Prisma.NewsletterCategoryWhereInput,
  ): Promise<NewsletterCategoryListResponseDto> {
    const [categories, groupedCounts] = await Promise.all([
      this.prisma.newsletterCategory.findMany({
        where,
        orderBy: { name: 'asc' },
      }),
      this.prisma.newsletterIssue.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
        where: {
          deletedAt: null,
          status: PublicationStatus.PUBLISHED,
        },
      }),
    ]);

    const countMap = new Map<string, number>(
      groupedCounts.map((item) => [item.categoryId, item._count._all]),
    );

    return {
      items: categories.map((category) =>
        this.toCategoryDto(category, countMap.get(category.id) ?? 0),
      ),
    };
  }

  private async unpinOtherNewsletterIssues(
    tx: PrismaService | PrismaTxClient,
    excludeId?: string,
  ): Promise<void> {
    await tx.newsletterIssue.updateMany({
      data: { isPinned: false },
      where: {
        isPinned: true,
        NOT: excludeId ? { id: excludeId } : undefined,
      },
    });
  }

  private async ensureIssueExists(id: string): Promise<void> {
    const exists = await this.prisma.newsletterIssue.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Newsletter issue not found');
    }
  }

  private async ensureCommentOnIssue(
    commentId: string,
    issueId: string,
  ): Promise<void> {
    const comment = await this.prisma.newsletterComment.findUnique({
      where: { id: commentId },
      select: { issueId: true },
    });
    if (!comment || comment.issueId !== issueId) {
      throw new BadRequestException('Parent comment not found on this issue');
    }
  }

  private async ensureCategoryExists(id: string): Promise<void> {
    const category = await this.prisma.newsletterCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Newsletter category not found');
    }
  }

  private async ensureUserExists(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('Author not found');
    }
  }

  private async ensureUniqueIssueSlug(
    baseSlug: string,
    ignoreId?: string,
  ): Promise<string> {
    let candidate = baseSlug;
    let counter = 2;

    while (true) {
      const existing = await this.prisma.newsletterIssue.findFirst({
        where: {
          slug: candidate,
          NOT: ignoreId ? { id: ignoreId } : undefined,
        },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
      candidate = `${baseSlug}-${counter++}`;
    }
  }

  private async ensureUniqueCategorySlug(
    baseSlug: string,
    ignoreId?: string,
  ): Promise<string> {
    let candidate = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.newsletterCategory.findFirst({
        where: {
          slug: candidate,
          NOT: ignoreId ? { id: ignoreId } : undefined,
        },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
      candidate = `${baseSlug}-${counter++}`;
    }
  }
}
