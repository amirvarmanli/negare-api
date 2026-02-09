import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BlogCategory,
  CommentStatus,
  Prisma,
  PublicationStatus,
  RoleName,
} from '@prisma/client';
import { PrismaService, PrismaTxClient } from '@app/prisma/prisma.service';
import { CreateBlogPostDto } from '@app/blog/dto/create-blog-post.dto';
import { UpdateBlogPostDto } from '@app/blog/dto/update-blog-post.dto';
import { BlogPostsQueryDto, BlogAdminPostsQueryDto } from '@app/blog/dto/blog-posts-query.dto';
import {
  AdminBlogSortBy,
  AdminBlogSortOrder,
  AdminBlogsListQueryDto,
} from '@app/blog/dto/admin-blogs-list-query.dto';
import {
  BlogAdminListItemDto,
  BlogAdminListResponseDto,
} from '@app/blog/dto/admin-blogs-list-item.dto';
import { BlogAdminAuthorDto } from '@app/blog/dto/admin-author.dto';
import { BlogAdminDetailDto } from '@app/blog/dto/admin-blog-detail.dto';
import { AdminUpdateBlogDto } from '@app/blog/dto/admin-update-blog.dto';
import { AdminRejectDto } from '@app/blog/dto/admin-reject.dto';
import { buildPaginationMeta } from '@app/common/dto/pagination.dto';
import {
  BlogPostDto,
  BlogPostListResponseDto,
} from '@app/blog/dto/blog-post.dto';
import {
  BlogCategoryDto,
  BlogCategoryListResponseDto,
} from '@app/blog/dto/blog-category.dto';
import { CreateBlogCategoryDto } from '@app/blog/dto/create-blog-category.dto';
import { UpdateBlogCategoryDto } from '@app/blog/dto/update-blog-category.dto';
import { CreateBlogCommentDto } from '@app/blog/dto/create-blog-comment.dto';
import {
  BlogCommentListResponseDto,
  BlogCommentDto,
} from '@app/blog/dto/blog-comment.dto';
import {
  BlogCommentsQueryDto,
  BlogAdminCommentsQueryDto,
} from '@app/blog/dto/blog-comments-query.dto';
import { UpdateBlogCommentStatusDto } from '@app/blog/dto/update-blog-comment-status.dto';
import { UpdateBlogPinStatusDto } from '@app/blog/dto/update-blog-pin-status.dto';
import { createSlug } from '@app/shared/utils/slug.util';
import {
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';

const AUTHOR_SUMMARY_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  username: true,
} as const;

const POST_SUMMARY_SELECT = {
  id: true,
  title: true,
  slug: true,
} as const;

const ADMIN_POST_INCLUDE = {
  category: true,
  author: { select: AUTHOR_SUMMARY_SELECT },
  _count: { select: { comments: true } },
} as const;

type BlogPostWithRelations = Prisma.BlogPostGetPayload<{
  include: {
    category: true;
    author: { select: typeof AUTHOR_SUMMARY_SELECT };
    _count: { select: { comments: true } };
  };
}>;

type BlogPostWithComments = Prisma.BlogPostGetPayload<{
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

type BlogCommentBase = Prisma.BlogCommentGetPayload<{
  include: {
    author: { select: typeof AUTHOR_SUMMARY_SELECT };
  };
}>;

type BlogCommentWithRelations = BlogCommentBase & {
  post?: { id: string; title: string; slug: string };
  replies?: BlogCommentWithRelations[];
};

@Injectable()
export class BlogService {
  private readonly defaultLimit = 10;
  private readonly maxLimit = 50;

  constructor(private readonly prisma: PrismaService) {}

  async listPublicPosts(
    query: BlogPostsQueryDto,
  ): Promise<BlogPostListResponseDto> {
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
    );

    const now = new Date();
    const where: Prisma.BlogPostWhereInput = {
      deletedAt: null,
      status: { in: this.publicStatusSet() },
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
      this.prisma.blogPost.findMany({
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
      this.prisma.blogPost.count({ where }),
    ]);

    return {
      items: items.map((post) => this.toPostDto(post)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async listPostsByCategorySlug(
    categorySlug: string,
    query: BlogPostsQueryDto,
  ): Promise<BlogPostListResponseDto> {
    const category = await this.prisma.blogCategory.findFirst({
      where: { slug: categorySlug, isActive: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.listPublicPosts({
      ...query,
      categorySlug,
    });
  }

  async getPostBySlug(slug: string): Promise<BlogPostDto> {
    const now = new Date();
    const post = await this.prisma.blogPost.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: { in: this.publicStatusSet() },
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

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    const dto = this.toPostDto(post as BlogPostWithComments);
    dto.comments = post.comments.map((comment) =>
      this.toCommentDto(comment as BlogCommentWithRelations, {
        includeReplies: true,
      }),
    );
    return dto;
  }

  async findAdminBlogPostById(
    id: string,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogPostDto> {
    const authenticatedUser = this.assertAuthenticated(currentUser);
    const isAdmin = this.isAdmin(authenticatedUser);

    const where: Prisma.BlogPostWhereInput = {
      id,
      deletedAt: null,
      ...(isAdmin ? undefined : { authorId: authenticatedUser.id }),
    };

    const post = await this.findAdminPost(where);
    if (!post) {
      throw new NotFoundException('Blog post not found');
    }
    return this.toPostDto(post);
  }

  async findAdminBlogPostBySlug(
    slug: string,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogPostDto> {
    const authenticatedUser = this.assertAuthenticated(currentUser);
    const isAdmin = this.isAdmin(authenticatedUser);

    const where: Prisma.BlogPostWhereInput = {
      slug,
      deletedAt: null,
      ...(isAdmin ? undefined : { authorId: authenticatedUser.id }),
    };

    const post = await this.findAdminPost(where);
    if (!post) {
      throw new NotFoundException('Blog post not found');
    }
    return this.toPostDto(post);
  }

  async listPostComments(
    slug: string,
    query: BlogCommentsQueryDto,
  ): Promise<BlogCommentListResponseDto> {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
    );

    const where: Prisma.BlogCommentWhereInput = {
      postId: post.id,
      status: CommentStatus.APPROVED,
      parentId: null,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.blogComment.findMany({
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
      this.prisma.blogComment.count({ where }),
    ]);

    return {
      items: items.map((item) =>
        this.toCommentDto(item as BlogCommentWithRelations, {
          includeReplies: true,
        }),
      ),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async listCategories(): Promise<BlogCategoryListResponseDto> {
    return this.buildCategoryList({ isActive: true });
  }

  async listAllCategories(): Promise<BlogCategoryListResponseDto> {
    return this.buildCategoryList({});
  }

  async createPost(
    dto: CreateBlogPostDto,
    authorId: string,
  ): Promise<BlogPostDto> {
    await this.ensureCategoryExists(dto.categoryId);
    const slugSource = dto.slug ?? dto.title;
    const slug = await this.ensureUniquePostSlug(createSlug(slugSource));
    const status = dto.status ?? PublicationStatus.DRAFT;
    const publishedAt = this.resolvePublishedAt(status, dto.publishedAt);

    const post = await this.prisma.$transaction(async (tx) => {
      if (dto.isPinned) {
        await this.unpinOtherBlogPosts(tx);
      }

      return tx.blogPost.create({
        data: {
          title: dto.title,
          slug,
          content: dto.content,
          excerpt: dto.excerpt,
          coverImageUrl: dto.coverImageUrl,
          status,
          publishedAt,
          categoryId: dto.categoryId,
          authorId,
          isFeatured: dto.isFeatured ?? false,
          isPinned: dto.isPinned ?? false,
          pinnedAt: dto.isPinned ? new Date() : null,
        },
        include: {
          category: true,
          author: { select: AUTHOR_SUMMARY_SELECT },
          _count: { select: { comments: true } },
        },
      });
    });

    return this.toPostDto(post);
  }

  async adminCreatePost(
    dto: CreateBlogPostDto,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogAdminDetailDto> {
    const admin = this.assertAdmin(currentUser);
    await this.ensureCategoryExists(dto.categoryId);
    const slugSource = dto.slug ?? dto.title;
    const slug = await this.ensureUniquePostSlug(createSlug(slugSource));
    const status = dto.status ?? PublicationStatus.DRAFT;
    const publishedAt = this.resolvePublishedAt(status, dto.publishedAt);
    const archivedAt =
      status === PublicationStatus.ARCHIVED ? new Date() : null;

    const post = await this.prisma.$transaction(async (tx) => {
      if (dto.isPinned) {
        await this.unpinOtherBlogPosts(tx);
      }

      return tx.blogPost.create({
        data: {
          title: dto.title,
          slug,
          content: dto.content,
          excerpt: dto.excerpt,
          coverImageUrl: dto.coverImageUrl,
          status,
          publishedAt,
          archivedAt,
          categoryId: dto.categoryId,
          authorId: admin.id,
          isFeatured: dto.isFeatured ?? false,
          isPinned: dto.isPinned ?? false,
          pinnedAt: dto.isPinned ? new Date() : null,
          pinnedByAdminId: dto.isPinned ? admin.id : null,
        },
        include: ADMIN_POST_INCLUDE,
      });
    });

    return this.toAdminDetailDto(post);
  }

  async updatePost(
    id: string,
    dto: UpdateBlogPostDto,
    currentUser: CurrentUserPayload,
  ): Promise<BlogPostDto> {
    const authenticatedUser = this.assertAuthenticated(currentUser);
    const existing = await this.prisma.blogPost.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        slug: true,
        authorId: true,
        status: true,
        publishedAt: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Blog post not found');
    }

    this.ensureOwnership(existing.authorId, authenticatedUser);

    const data: Prisma.BlogPostUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.coverImageUrl !== undefined)
      data.coverImageUrl = dto.coverImageUrl;
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
      data.slug = await this.ensureUniquePostSlug(
        createSlug(dto.slug),
        existing.id,
      );
    }

    const newStatus = dto.status ?? existing.status;
    if (dto.publishedAt !== undefined) {
      data.publishedAt = dto.publishedAt;
    } else if (
      this.isPublishedStatus(newStatus) &&
      !this.isPublishedStatus(existing.status) &&
      !existing.publishedAt
    ) {
      data.publishedAt = new Date();
    }

    const post = await this.prisma.$transaction(async (tx) => {
      if (dto.isPinned === true) {
        await this.unpinOtherBlogPosts(tx, id);
      }

      return tx.blogPost.update({
        where: { id },
        data,
        include: {
          category: true,
          author: { select: AUTHOR_SUMMARY_SELECT },
          _count: { select: { comments: true } },
        },
      });
    });

    return this.toPostDto(post);
  }

  async softDeletePost(
    id: string,
    currentUser: CurrentUserPayload,
  ): Promise<void> {
    const authenticatedUser = this.assertAuthenticated(currentUser);
    const existing = await this.prisma.blogPost.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true },
    });
    if (!existing) {
      throw new NotFoundException('Blog post not found');
    }

    this.ensureOwnership(existing.authorId, authenticatedUser);

    await this.prisma.blogPost.update({
      where: { id },
      data: {
        status: PublicationStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });
  }

  async adminSoftDeletePost(
    id: string,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<void> {
    const admin = this.assertAdmin(currentUser);
    const existing = await this.prisma.blogPost.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, archivedAt: true },
    });
    if (!existing) {
      throw new NotFoundException('Blog post not found');
    }

    await this.prisma.blogPost.update({
      where: { id },
      data: {
        status: PublicationStatus.ARCHIVED,
        archivedAt: existing.archivedAt ?? new Date(),
        deletedAt: new Date(),
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
        rejectReason: null,
      },
    });
  }

  async adminListPosts(
    query: BlogAdminPostsQueryDto,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogPostListResponseDto> {
    const authenticatedUser = this.assertAuthenticated(currentUser);
    const isAdmin = this.isAdmin(authenticatedUser);
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
    );

    const where: Prisma.BlogPostWhereInput = {
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
      where.authorId = authenticatedUser.id;
    }

    this.applySearchFilters(where, query.q);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
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
      this.prisma.blogPost.count({ where }),
    ]);

    return {
      items: items.map((post) => this.toPostDto(post)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async adminListAllPosts(
    query: AdminBlogsListQueryDto,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogAdminListResponseDto> {
    this.assertAdmin(currentUser);
    const { page, limit, skip } = this.resolveAdminPagination(
      query.page,
      query.limit,
    );

    const where: Prisma.BlogPostWhereInput = {
      deletedAt: null,
      status: query.status,
      authorId: query.authorId,
    };

    if (query.from || query.to) {
      where.createdAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }

    this.applyAdminSearchFilters(where, query.q);

    const sortBy = query.sort ?? AdminBlogSortBy.createdAt;
    const sortOrder = query.order ?? AdminBlogSortOrder.desc;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: ADMIN_POST_INCLUDE,
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return {
      items: items.map((post) => this.toAdminListItemDto(post)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async adminGetPost(
    id: string,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogAdminDetailDto> {
    this.assertAdmin(currentUser);
    const post = await this.prisma.blogPost.findFirst({
      where: { id, deletedAt: null },
      include: ADMIN_POST_INCLUDE,
    });
    if (!post) {
      throw new NotFoundException('Blog post not found');
    }
    return this.toAdminDetailDto(post);
  }

  async adminUpdatePost(
    id: string,
    dto: AdminUpdateBlogDto,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogAdminDetailDto> {
    const admin = this.assertAdmin(currentUser);
    const existing = await this.prisma.blogPost.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        slug: true,
        status: true,
        publishedAt: true,
        archivedAt: true,
        rejectReason: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Blog post not found');
    }

    const data: Prisma.BlogPostUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.browserTitle !== undefined) data.browserTitle = dto.browserTitle;
    if (dto.coverImageUrl !== undefined)
      data.coverImageUrl = dto.coverImageUrl;
    if (dto.previewCoverUrl !== undefined)
      data.previewCoverUrl = dto.previewCoverUrl;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.publishedAt !== undefined) data.publishedAt = dto.publishedAt;

    if (dto.slug) {
      data.slug = await this.ensureUniquePostSlug(
        createSlug(dto.slug),
        existing.id,
      );
    }

    if (dto.status !== undefined) {
      data.reviewedAt = new Date();
      data.reviewedByAdminId = admin.id;
      if (dto.status === PublicationStatus.ARCHIVED) {
        data.archivedAt = new Date();
      } else if (existing.archivedAt) {
        data.archivedAt = null;
      }
      if (dto.status !== PublicationStatus.REJECTED) {
        data.rejectReason = null;
      }
    }

    const newStatus = dto.status ?? existing.status;
    if (dto.publishedAt !== undefined) {
      data.publishedAt = dto.publishedAt;
    } else if (
      this.isPublishedStatus(newStatus) &&
      !this.isPublishedStatus(existing.status) &&
      !existing.publishedAt
    ) {
      data.publishedAt = new Date();
    }

    const post = await this.prisma.blogPost.update({
      where: { id },
      data,
      include: ADMIN_POST_INCLUDE,
    });

    return this.toAdminDetailDto(post);
  }

  async adminApprovePost(
    id: string,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogAdminDetailDto> {
    const admin = this.assertAdmin(currentUser);
    const existing = await this.prisma.blogPost.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, publishedAt: true },
    });
    if (!existing) {
      throw new NotFoundException('Blog post not found');
    }

    const post = await this.prisma.blogPost.update({
      where: { id },
      data: {
        status: PublicationStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
        rejectReason: null,
        archivedAt: null,
        publishedAt: existing.publishedAt ?? new Date(),
      },
      include: ADMIN_POST_INCLUDE,
    });

    return this.toAdminDetailDto(post);
  }

  async adminRejectPost(
    id: string,
    dto: AdminRejectDto,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogAdminDetailDto> {
    const admin = this.assertAdmin(currentUser);
    const existing = await this.prisma.blogPost.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Blog post not found');
    }

    const post = await this.prisma.blogPost.update({
      where: { id },
      data: {
        status: PublicationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
        rejectReason: dto.reason ?? null,
        archivedAt: null,
      },
      include: ADMIN_POST_INCLUDE,
    });

    return this.toAdminDetailDto(post);
  }

  async adminArchivePost(
    id: string,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogAdminDetailDto> {
    const admin = this.assertAdmin(currentUser);
    const existing = await this.prisma.blogPost.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Blog post not found');
    }

    const post = await this.prisma.blogPost.update({
      where: { id },
      data: {
        status: PublicationStatus.ARCHIVED,
        archivedAt: new Date(),
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
        rejectReason: null,
      },
      include: ADMIN_POST_INCLUDE,
    });

    return this.toAdminDetailDto(post);
  }

  async adminUnarchivePost(
    id: string,
    currentUser: CurrentUserPayload | undefined,
  ): Promise<BlogAdminDetailDto> {
    const admin = this.assertAdmin(currentUser);
    const existing = await this.prisma.blogPost.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, publishedAt: true },
    });
    if (!existing) {
      throw new NotFoundException('Blog post not found');
    }

    const status = existing.publishedAt
      ? PublicationStatus.APPROVED
      : PublicationStatus.PENDING;

    const post = await this.prisma.blogPost.update({
      where: { id },
      data: {
        status,
        archivedAt: null,
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
        rejectReason: null,
      },
      include: ADMIN_POST_INCLUDE,
    });

    return this.toAdminDetailDto(post);
  }

  async updatePostPinStatus(
    id: string,
    dto: UpdateBlogPinStatusDto,
    currentUser: CurrentUserPayload,
  ): Promise<BlogPostDto> {
    const authenticated = this.assertAuthenticated(currentUser);
    const post = await this.prisma.$transaction(
      async (tx) => {
        const target = await tx.blogPost.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, isPinned: true },
        });
        if (!target) {
          throw new NotFoundException('Blog post not found');
        }

        if (dto.isPinned) {
          const pinned = await tx.blogPost.findFirst({
            where: { isPinned: true, deletedAt: null },
            select: { id: true },
          });

          if (pinned && pinned.id !== id) {
            await tx.blogPost.update({
              where: { id: pinned.id },
              data: {
                isPinned: false,
                pinnedAt: null,
                pinnedByAdminId: null,
              },
            });
          }

          if (!target.isPinned) {
            await tx.blogPost.update({
              where: { id },
              data: {
                isPinned: true,
                pinnedAt: new Date(),
                pinnedByAdminId: authenticated.id,
              },
            });
          }
        } else {
          await tx.blogPost.update({
            where: { id },
            data: {
              isPinned: false,
              pinnedAt: null,
              pinnedByAdminId: null,
            },
          });
        }

        return tx.blogPost.findFirst({
          where: { id, deletedAt: null },
          include: {
            category: true,
            author: { select: AUTHOR_SUMMARY_SELECT },
            _count: { select: { comments: true } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return this.toPostDto(post);
  }

  async createComment(
    postId: string,
    dto: CreateBlogCommentDto,
    authorId: string,
  ): Promise<BlogCommentDto> {
    await this.ensurePostExists(postId);
    if (dto.parentId) {
      await this.ensureCommentOnPost(dto.parentId, postId);
    }

    const comment = await this.prisma.blogComment.create({
      data: {
        postId,
        authorId,
        content: dto.content,
        parentId: dto.parentId ?? null,
      },
      include: {
        author: { select: AUTHOR_SUMMARY_SELECT },
      },
    });

    return this.toCommentDto(comment as BlogCommentWithRelations);
  }

  async adminListComments(
    query: BlogAdminCommentsQueryDto,
  ): Promise<BlogCommentListResponseDto> {
    const { page, limit, skip } = this.resolvePagination(
      query.page,
      query.limit,
    );

    const where: Prisma.BlogCommentWhereInput = {
      status: query.status,
      postId: query.postId,
      content: query.q
        ? { contains: query.q.trim(), mode: 'insensitive' }
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.blogComment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: AUTHOR_SUMMARY_SELECT },
          post: { select: POST_SUMMARY_SELECT },
        },
      }),
      this.prisma.blogComment.count({ where }),
    ]);

    return {
      items: items.map((comment) =>
        this.toCommentDto(comment as BlogCommentWithRelations, {
          includePost: true,
        }),
      ),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async updateCommentStatus(
    id: string,
    dto: UpdateBlogCommentStatusDto,
  ): Promise<BlogCommentDto> {
    try {
      const comment = await this.prisma.blogComment.update({
        where: { id },
        data: { status: dto.status },
        include: {
          author: { select: AUTHOR_SUMMARY_SELECT },
          post: { select: POST_SUMMARY_SELECT },
        },
      });

      return this.toCommentDto(comment as BlogCommentWithRelations, {
        includePost: true,
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
    dto: CreateBlogCategoryDto,
  ): Promise<BlogCategoryDto> {
    if (dto.parentId) {
      await this.ensureCategoryExists(dto.parentId);
    }

    const slug = await this.ensureUniqueCategorySlug(
      createSlug(dto.slug ?? dto.name),
    );

    const category = await this.prisma.blogCategory.create({
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
    dto: UpdateBlogCategoryDto,
  ): Promise<BlogCategoryDto> {
    const existing = await this.prisma.blogCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    if (dto.parentId && dto.parentId === id) {
      throw new BadRequestException('Category cannot parent itself');
    }

    if (dto.parentId) {
      await this.ensureCategoryExists(dto.parentId);
    }

    const data: Prisma.BlogCategoryUpdateInput = {};
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

    const updated = await this.prisma.blogCategory.update({
      where: { id },
      data,
    });

    const publishedCount = await this.prisma.blogPost.count({
      where: {
        categoryId: id,
        status: { in: this.publicStatusSet() },
        deletedAt: null,
      },
    });

    return this.toCategoryDto(updated, publishedCount);
  }

  async deleteCategory(id: string): Promise<void> {
    const existing = await this.prisma.blogCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    await this.prisma.blogCategory.update({
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
    if (this.isPublishedStatus(status)) {
      return new Date();
    }
    return null;
  }

  private async findAdminPost(
    where: Prisma.BlogPostWhereInput,
  ): Promise<BlogPostWithRelations | null> {
    return this.prisma.blogPost.findFirst({
      where,
      include: ADMIN_POST_INCLUDE,
    });
  }

  private ensurePublicPublicationClause(
    where: Prisma.BlogPostWhereInput,
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
    where: Prisma.BlogPostWhereInput,
    clause: Prisma.BlogPostWhereInput,
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
    where: Prisma.BlogPostWhereInput,
    query?: string,
  ): void {
    if (!query) {
      return;
    }
    const search = query.trim();
    if (!search) {
      return;
    }

    const clause: Prisma.BlogPostWhereInput = {
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
    if (!this.isAdmin(user) && authorId !== user.id) {
      throw new ForbiddenException('Not authorized to modify this post');
    }
  }

  private assertAdmin(
    user?: CurrentUserPayload | undefined,
  ): CurrentUserPayload {
    const authenticated = this.assertAuthenticated(user);
    if (!this.isAdmin(authenticated)) {
      throw new ForbiddenException('Admin access required');
    }
    return authenticated;
  }

  private resolveAdminPagination(
    page?: number,
    limit?: number,
  ): { page: number; limit: number; skip: number } {
    const safePage = page && page > 0 ? page : 1;
    const rawLimit = limit && limit > 0 ? limit : 20;
    const safeLimit = Math.min(rawLimit, 100);
    const skip = (safePage - 1) * safeLimit;
    return { page: safePage, limit: safeLimit, skip };
  }

  private applyAdminSearchFilters(
    where: Prisma.BlogPostWhereInput,
    query?: string,
  ): void {
    if (!query) {
      return;
    }
    const search = query.trim();
    if (!search) {
      return;
    }

    const clause: Prisma.BlogPostWhereInput = {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        {
          author: {
            is: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    };

    this.addAndClause(where, clause);
  }

  private toAdminListItemDto(post: BlogPostWithRelations): BlogAdminListItemDto {
    return {
      id: post.id,
      title: post.title,
      coverImageUrl: post.coverImageUrl ?? null,
      slug: post.slug,
      excerpt: post.excerpt ?? null,
      status: post.status,
      publishedAt: post.publishedAt,
      archivedAt: post.archivedAt ?? null,
      reviewedAt: post.reviewedAt ?? null,
      reviewedByAdminId: post.reviewedByAdminId ?? null,
      rejectReason: post.rejectReason ?? null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: this.toAdminAuthorDto(post.author),
      category: this.toCategoryDto(post.category, 0),
    };
  }

  private toAdminDetailDto(post: BlogPostWithRelations): BlogAdminDetailDto {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      browserTitle: post.browserTitle ?? null,
      excerpt: post.excerpt ?? null,
      content: post.content,
      coverImageUrl: post.coverImageUrl ?? null,
      previewCoverUrl: post.previewCoverUrl ?? null,
      status: post.status,
      publishedAt: post.publishedAt,
      archivedAt: post.archivedAt ?? null,
      reviewedAt: post.reviewedAt ?? null,
      reviewedByAdminId: post.reviewedByAdminId ?? null,
      rejectReason: post.rejectReason ?? null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      isFeatured: post.isFeatured,
      isPinned: post.isPinned,
      viewCount: post.viewCount,
      commentCount: post._count?.comments ?? 0,
      category: this.toCategoryDto(post.category, 0),
      author: this.toAdminAuthorDto(post.author),
    };
  }

  private toAdminAuthorDto(
    author: BlogPostWithRelations['author'],
  ): BlogAdminAuthorDto {
    return {
      userId: author.id,
      fullName: this.resolveAuthorFullName(author),
      avatarUrl: author.avatarUrl ?? null,
      email: author.email ?? null,
      role: author.role,
    };
  }

  private resolveAuthorFullName(
    author: BlogPostWithRelations['author'],
  ): string | null {
    const first = author.firstName?.trim() ?? '';
    const last = author.lastName?.trim() ?? '';
    const combined = `${first} ${last}`.trim();
    if (combined) {
      return combined;
    }
    const name = author.name?.trim();
    if (name) {
      return name;
    }
    const username = author.username?.trim();
    if (username) {
      return username;
    }
    const email = author.email?.trim();
    if (email) {
      return email;
    }
    return null;
  }

  private publicStatusSet(): PublicationStatus[] {
    return [PublicationStatus.PUBLISHED, PublicationStatus.APPROVED];
  }

  private isPublishedStatus(status: PublicationStatus): boolean {
    return (
      status === PublicationStatus.PUBLISHED ||
      status === PublicationStatus.APPROVED
    );
  }

  private toPostDto(post: BlogPostWithRelations): BlogPostDto {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.excerpt,
      excerpt: post.excerpt,
      content: post.content,
      coverImageUrl: post.coverImageUrl,
      status: post.status,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      viewCount: post.viewCount,
      isFeatured: post.isFeatured,
      isPinned: post.isPinned,
      commentCount: post._count?.comments ?? 0,
      category: this.toCategoryDto(post.category, 0),
      author: {
        id: post.author.id,
        name: post.author.name,
        avatarUrl: post.author.avatarUrl,
      },
    };
  }

  private toCommentDto(
    comment: BlogCommentWithRelations,
    options?: { includeReplies?: boolean; includePost?: boolean },
  ): BlogCommentDto {
    const dto: BlogCommentDto = {
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

    if (options?.includePost && comment.post) {
      dto.post = {
        id: comment.post.id,
        title: comment.post.title,
        slug: comment.post.slug,
      };
    }

    if (options?.includeReplies && comment.replies) {
      dto.replies = comment.replies.map((reply) =>
        this.toCommentDto(reply as BlogCommentWithRelations, {
          includeReplies: false,
        }),
      );
    }

    return dto;
  }

  private toCategoryDto(category: BlogCategory, postCount: number): BlogCategoryDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
      isActive: category.isActive,
      parentId: category.parentId ?? null,
      postCount,
    };
  }

  private async buildCategoryList(
    where: Prisma.BlogCategoryWhereInput,
  ): Promise<BlogCategoryListResponseDto> {
    const [categories, groupedCounts] = await Promise.all([
      this.prisma.blogCategory.findMany({
        where,
        orderBy: { name: 'asc' },
      }),
      this.prisma.blogPost.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
        where: {
          deletedAt: null,
          status: { in: this.publicStatusSet() },
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

  private async unpinOtherBlogPosts(
    tx: PrismaService | PrismaTxClient,
    excludeId?: string,
  ): Promise<void> {
    await tx.blogPost.updateMany({
      data: { isPinned: false, pinnedAt: null, pinnedByAdminId: null },
      where: {
        isPinned: true,
        NOT: excludeId ? { id: excludeId } : undefined,
      },
    });
  }

  private async ensurePostExists(id: string): Promise<void> {
    const exists = await this.prisma.blogPost.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Blog post not found');
    }
  }

  private async ensureCommentOnPost(
    commentId: string,
    postId: string,
  ): Promise<void> {
    const comment = await this.prisma.blogComment.findUnique({
      where: { id: commentId },
      select: { postId: true },
    });
    if (!comment || comment.postId !== postId) {
      throw new BadRequestException('Parent comment not found on this post');
    }
  }

  private async ensureCategoryExists(id: string): Promise<void> {
    const category = await this.prisma.blogCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
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

  private async ensureUniquePostSlug(
    baseSlug: string,
    ignoreId?: string,
  ): Promise<string> {
    let candidate = baseSlug;
    let counter = 2;

    while (true) {
      const existing = await this.prisma.blogPost.findFirst({
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
      const existing = await this.prisma.blogCategory.findFirst({
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
