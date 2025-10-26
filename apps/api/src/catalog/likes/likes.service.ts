import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Like } from '../entities/content/like.entity';
import { Product } from '../entities/content/product.entity';
import { ListQueryDto } from '../dtos/list-query.dto';
import { paginate, PaginationResult } from '../utils/pagination.util';

export interface ToggleLikeResult {
  liked: boolean;
  likesCount: number;
}

@Injectable()
export class LikesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async toggleLike(
    userId: string,
    productId: string,
    desiredState?: boolean,
  ): Promise<ToggleLikeResult> {
    this.ensureNumericId(productId);

    return this.dataSource.transaction(async (manager) => {
      let product: Product | null = null;
      try {
        product = await manager
          .getRepository(Product)
          .createQueryBuilder('product')
          .setLock('pessimistic_write')
          .where('product.id = :productId', { productId })
          .getOne();
      } catch (error) {
        if (this.shouldRetryWithoutLock(error)) {
          product = await manager.getRepository(Product).findOne({
            where: { id: productId },
          });
        } else {
          throw error;
        }
      }

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      const likesRepo = manager.getRepository(Like);
      const existing = await likesRepo.findOne({
        where: { userId, productId },
      });

      let liked: boolean;

      if (desiredState === undefined) {
        liked = !existing;
        if (existing) {
          const removed = await likesRepo.delete({ userId, productId });
          if ((removed.affected ?? 0) > 0) {
            await this.adjustLikesCount(manager, productId, -1);
          }
        } else {
          const inserted = await this.insertLike(likesRepo, userId, productId);
          if (inserted) {
            await this.adjustLikesCount(manager, productId, 1);
          }
        }
      } else if (desiredState) {
        liked = true;
        if (!existing) {
          const inserted = await this.insertLike(likesRepo, userId, productId);
          if (inserted) {
            await this.adjustLikesCount(manager, productId, 1);
          }
        }
      } else {
        liked = false;
        if (existing) {
          const removed = await likesRepo.delete({ userId, productId });
          if ((removed.affected ?? 0) > 0) {
            await this.adjustLikesCount(manager, productId, -1);
          }
        }
      }

      const likesCount = await this.getLikesCount(manager, productId);

      return { liked, likesCount };
    });
  }

  async isProductLiked(userId: string, productId: string): Promise<boolean> {
    this.ensureNumericId(productId);

    const like = await this.likesRepository.findOne({
      where: { userId, productId },
      select: ['userId', 'productId'],
    });
    return Boolean(like);
  }

  async listLikedProducts(
    userId: string,
    query: ListQueryDto,
  ): Promise<PaginationResult<Product>> {
    const { page, limit } = this.resolvePagination(query);
    const qb = this.buildLikedProductsQuery(userId);

    return paginate(qb, page, limit);
  }

  private buildLikedProductsQuery(userId: string): SelectQueryBuilder<Product> {
    return this.productsRepository
      .createQueryBuilder('product')
      .innerJoin(
        Like,
        'like',
        'like.productId = product.id AND like.userId = :userId',
        { userId },
      )
      .leftJoinAndSelect('product.categories', 'categories')
      .leftJoinAndSelect('product.tags', 'tags')
      .leftJoinAndSelect('product.suppliers', 'suppliers')
      .leftJoinAndSelect('product.assets', 'assets')
      .addSelect('like.createdAt', 'like_createdAt')
      .orderBy('like.createdAt', 'DESC')
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

  private async adjustLikesCount(
    manager: EntityManager,
    productId: string,
    delta: number,
  ): Promise<void> {
    const columnMeta =
      this.productsRepository.metadata.findColumnWithPropertyName('likesCount');

    if (!columnMeta) {
      throw new InternalServerErrorException(
        'Unable to resolve product likesCount metadata',
      );
    }

    const databasePath = `"${columnMeta.databasePath}"`;
    if (delta >= 0) {
      await manager
        .createQueryBuilder()
        .update(Product)
        .set({
          likesCount: () => `${databasePath} + (${delta})`,
        })
        .where('id = :productId', { productId })
        .execute();
      return;
    }

    await manager
      .createQueryBuilder()
      .update(Product)
      .set({
        likesCount: () => `GREATEST(${databasePath} + (${delta}), 0)`,
      })
      .where('id = :productId', { productId })
      .execute();
  }

  private async getLikesCount(
    manager: EntityManager,
    productId: string,
  ): Promise<number> {
    const refreshed = await manager
      .createQueryBuilder(Product, 'product')
      .select('product.likesCount', 'likesCount')
      .where('product.id = :productId', { productId })
      .getRawOne<{ likesCount: number | string | null }>();

    if (!refreshed || refreshed.likesCount === undefined || refreshed.likesCount === null) {
      throw new NotFoundException('Product not found');
    }

    const parsed = Number.parseInt(String(refreshed.likesCount), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private async insertLike(
    likesRepo: Repository<Like>,
    userId: string,
    productId: string,
  ): Promise<boolean> {
    try {
      await likesRepo.insert({ userId, productId });
      return true;
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
      return false;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      typeof error.driverError?.code === 'string' &&
      error.driverError.code === '23505'
    );
  }

  private shouldRetryWithoutLock(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const message = String((error as Error).message).toLowerCase();
    return message.includes('for update') || message.includes('pessimistic');
  }
}
