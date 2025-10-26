import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/content/product.entity';

@Injectable()
export class CountersService {
  private readonly logger = new Logger(CountersService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async incrementViews(productId: string): Promise<void> {
    await this.incrementColumn(productId, 'viewsCount');
  }

  async incrementDownloads(productId: string): Promise<void> {
    await this.incrementColumn(productId, 'downloadsCount');
  }

  async incrementLikes(productId: string): Promise<void> {
    await this.incrementColumn(productId, 'likesCount');
  }

  async decrementLikes(productId: string): Promise<void> {
    await this.incrementColumn(productId, 'likesCount', -1);
  }

  private async incrementColumn(
    productId: string,
    column: keyof Pick<Product, 'viewsCount' | 'downloadsCount' | 'likesCount'>,
    delta = 1,
  ): Promise<void> {
    try {
      const columnMeta =
        this.productsRepository.metadata.findColumnWithPropertyName(column);
      if (!columnMeta) {
        throw new Error(`Unable to resolve column metadata for ${String(column)}`);
      }

      if (delta >= 0) {
        await this.productsRepository.increment({ id: productId }, column, delta);
        return;
      }

      const databasePath = `"${columnMeta.databasePath}"`;
      await this.productsRepository
        .createQueryBuilder()
        .update(Product)
        .set({
          [column]: () => `GREATEST(${databasePath} + (${delta}), 0)`,
        })
        .where('id = :productId', { productId })
        .execute();
    } catch (error) {
      this.logger.error(
        `Failed to increment ${String(column)} for product ${productId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
