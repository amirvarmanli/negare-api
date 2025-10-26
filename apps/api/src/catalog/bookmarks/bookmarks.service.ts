import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Bookmark } from '../entities/content/bookmark.entity';
import { Product } from '../entities/content/product.entity';
import { ListQueryDto } from '../dtos/list-query.dto';
import { paginate, PaginationResult } from '../utils/pagination.util';

export interface ToggleBookmarkResult {
  bookmarked: boolean;
}

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark)
    private readonly bookmarksRepository: Repository<Bookmark>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async toggleBookmark(
    userId: string,
    productId: string,
    desiredState?: boolean,
  ): Promise<ToggleBookmarkResult> {
    this.ensureNumericId(productId);

    const product = await this.productsRepository.findOne({
      where: { id: productId },
      select: ['id'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.bookmarksRepository.findOne({
      where: { userId, productId },
    });

    let bookmarked: boolean;

    if (desiredState === undefined) {
      bookmarked = !existing;
      if (existing) {
        await this.bookmarksRepository.delete({ userId, productId });
      } else {
        await this.insertBookmark(userId, productId);
      }
    } else if (desiredState) {
      bookmarked = true;
      if (!existing) {
        await this.insertBookmark(userId, productId);
      }
    } else {
      bookmarked = false;
      if (existing) {
        await this.bookmarksRepository.delete({ userId, productId });
      }
    }

    return { bookmarked };
  }

  async isBookmarked(userId: string, productId: string): Promise<boolean> {
    this.ensureNumericId(productId);

    const bookmark = await this.bookmarksRepository.findOne({
      where: { userId, productId },
      select: ['userId', 'productId'],
    });

    return Boolean(bookmark);
  }

  async listBookmarkedProducts(
    userId: string,
    query: ListQueryDto,
  ): Promise<PaginationResult<Product>> {
    const { page, limit } = this.resolvePagination(query);
    const qb = this.buildBookmarkedProductsQuery(userId);

    return paginate(qb, page, limit);
  }

  private buildBookmarkedProductsQuery(
    userId: string,
  ): SelectQueryBuilder<Product> {
    return this.productsRepository
      .createQueryBuilder('product')
      .innerJoin(
        Bookmark,
        'bookmark',
        'bookmark.productId = product.id AND bookmark.userId = :userId',
        { userId },
      )
      .leftJoinAndSelect('product.categories', 'categories')
      .leftJoinAndSelect('product.tags', 'tags')
      .leftJoinAndSelect('product.suppliers', 'suppliers')
      .leftJoinAndSelect('product.assets', 'assets')
      .addSelect('bookmark.createdAt', 'bookmark_createdAt')
      .orderBy('bookmark.createdAt', 'DESC')
      .addOrderBy('product.id', 'DESC');
  }

  private resolvePagination(query: ListQueryDto): {
    page: number;
    limit: number;
  } {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 24, 100);
    return { page, limit };
  }

  private ensureNumericId(productId: string): void {
    if (!/^\d+$/.test(productId)) {
      throw new BadRequestException('Product id must be numeric');
    }
  }

  private async insertBookmark(
    userId: string,
    productId: string,
  ): Promise<void> {
    try {
      await this.bookmarksRepository.insert({ userId, productId });
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      typeof error.driverError?.code === 'string' &&
      error.driverError.code === '23505'
    );
  }
}
