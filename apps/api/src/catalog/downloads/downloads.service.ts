import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Product, PricingType } from '../entities/content/product.entity';
import { ProductDownload } from '../entities/analytics/product-download.entity';
import { CountersService } from '../counters/counters.service';
import { StorageService } from '../storage/storage.service';

const DAILY_CAP = 15;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export interface DownloadResult {
  stream: NodeJS.ReadableStream;
  filename?: string | null;
  mimeType?: string | null;
  size?: number;
  downloadsCount: number;
}

@Injectable()
export class DownloadsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductDownload)
    private readonly productDownloadsRepository: Repository<ProductDownload>,
    private readonly countersService: CountersService,
    private readonly storageService: StorageService,
  ) {}

  async enforceDailyCap(userId: string): Promise<void> {
    const windowStart = new Date(Date.now() - TWENTY_FOUR_HOURS);

    const downloadCount = await this.productDownloadsRepository.count({
      where: {
        userId,
        createdAt: MoreThanOrEqual(windowStart),
      },
    });

    if (downloadCount >= DAILY_CAP) {
      throw new HttpException(
        'Daily download limit reached. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async downloadProduct(
    productId: string,
    userId?: string,
  ): Promise<DownloadResult> {
    if (!userId) {
      throw new UnauthorizedException('Authentication is required to download this product');
    }

    const product = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.file', 'file')
      .where('product.id = :productId', { productId })
      .select(['product.id', 'product.pricingType', 'product.downloadsCount', 'file.id', 'file.originalName', 'file.size', 'file.mimeType', 'file.createdAt'])
      .addSelect('file.storageKey')
      .getOne();

    if (!product || !product.file) {
      throw new NotFoundException('Product file not found');
    }

    await this.enforceDailyCap(userId);
    await this.checkPricingRequirements(
      { id: product.id, pricingType: product.pricingType },
      userId,
    );

    await this.productDownloadsRepository.insert({
      productId,
      userId,
    });

    await this.countersService.incrementDownloads(productId);

    const refreshed = await this.productsRepository.findOne({
      where: { id: productId },
      select: ['id', 'downloadsCount'],
    });

    const stream = this.storageService.getDownloadStream(product.file.storageKey);
    const downloadsCount =
      refreshed?.downloadsCount ?? product.downloadsCount + 1;

    return {
      stream,
      filename: product.file.originalName ?? null,
      mimeType: product.file.mimeType ?? null,
      size: product.file.size ? Number(product.file.size) : undefined,
      downloadsCount:
        typeof downloadsCount === 'number'
          ? downloadsCount
          : Number.parseInt(String(downloadsCount), 10),
    };
  }

  private async checkPricingRequirements(
    product: Pick<Product, 'id' | 'pricingType'>,
    userId: string,
  ): Promise<void> {
    switch (product.pricingType) {
      case PricingType.PAID: {
        const owns = await this.checkPaidOwnership(userId, product.id);
        if (!owns) {
          throw new ForbiddenException(
            'Purchase required to download this product.',
          );
        }
        break;
      }
      case PricingType.SUBSCRIPTION:
      case PricingType.PAID_OR_SUBSCRIPTION: {
        const active = await this.checkActiveSubscription(userId);
        if (!active) {
          throw new ForbiddenException(
            'Active subscription required to download this product.',
          );
        }
        break;
      }
      default:
        break;
    }
  }

  private async checkPaidOwnership(
    userId: string,
    productId: string,
  ): Promise<boolean> {
    // TODO: Integrate with purchase/billing service to confirm ownership.
    void userId;
    void productId;
    return true;
  }

  private async checkActiveSubscription(userId: string): Promise<boolean> {
    // TODO: Integrate with subscription service to confirm entitlements.
    void userId;
    return true;
  }
}





