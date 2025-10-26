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
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { CurrentUserPayload } from '@app/common/decorators/current-user.decorator';
import { paginate, PaginationResult } from '../utils/pagination.util';
import { buildUniqueSlugCandidate, slugify } from '../utils/slug.util';
import {
  Product,
  PricingType,
} from '../entities/content/product.entity';
import { ProductAsset } from '../entities/content/product-asset.entity';
import { ProductFile } from '../entities/content/product-file.entity';
import { Category } from '../entities/content/category.entity';
import { Tag } from '../entities/content/tag.entity';
import { User } from '@app/core/users/user.entity';
import { ProductView } from '../entities/analytics/product-view.entity';
import { CountersService } from '../counters/counters.service';
import { LikesService } from '../likes/likes.service';
import { BookmarksService } from '../bookmarks/bookmarks.service';
import { StorageService, UploadedFile } from '../storage/storage.service';
import { ProductDetailResponseDto } from './dtos/product-detail-response.dto';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import {
  ListProductsQueryDto,
  ProductSortOption,
} from './dtos/list-products-query.dto';
import { isAdmin, isSupplier } from '../policies/catalog.policies';

@Injectable()
export class ProductsService {
  private readonly slugMaxAttempts = 10;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductFile)
    private readonly productFilesRepository: Repository<ProductFile>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(ProductView)
    private readonly productViewsRepository: Repository<ProductView>,
    private readonly countersService: CountersService,
    private readonly likesService: LikesService,
    private readonly bookmarksService: BookmarksService,
    private readonly storageService: StorageService,
  ) {}

  async listProducts(
    query: ListProductsQueryDto,
  ): Promise<PaginationResult<Product>> {
    const qb = this.buildListQuery(query);
    return paginate(qb, query.page ?? 1, query.limit ?? 24);
  }

  private buildListQuery(
    query: ListProductsQueryDto,
  ): SelectQueryBuilder<Product> {
    const qb = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'categories')
      .leftJoinAndSelect('product.tags', 'tags')
      .leftJoinAndSelect('product.suppliers', 'suppliers')
      .leftJoinAndSelect('product.assets', 'assets')
      .distinct(true);

    if (query.q) {
      qb.andWhere(
        '(product.title ILIKE :search OR product.description ILIKE :search)',
        { search: `%${query.q}%` },
      );
    }

    if (query.category) {
      const isNumeric = /^\d+$/.test(query.category);
      qb.innerJoin('product.categories', 'filterCategory');
      if (isNumeric) {
        qb.andWhere('filterCategory.id = :categoryId', {
          categoryId: query.category,
        });
      } else {
        qb.andWhere('LOWER(filterCategory.slug) = LOWER(:categorySlug)', {
          categorySlug: query.category,
        });
      }
    }

    if (query.tag) {
      const isNumeric = /^\d+$/.test(query.tag);
      qb.innerJoin('product.tags', 'filterTag');
      if (isNumeric) {
        qb.andWhere('filterTag.id = :tagId', { tagId: query.tag });
      } else {
        qb.andWhere('LOWER(filterTag.slug) = LOWER(:tagSlug)', {
          tagSlug: query.tag,
        });
      }
    }

    if (query.supplierId) {
      qb.innerJoin('product.suppliers', 'filterSupplier');
      qb.andWhere('filterSupplier.id = :supplierId', {
        supplierId: query.supplierId,
      });
    }

    if (query.pricingType) {
      const pricingTypes = query.pricingType
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter((value): value is PricingType =>
          Object.values(PricingType).includes(value as PricingType),
        );

      if (pricingTypes.length > 0) {
        qb.andWhere('product.pricingType IN (:...pricingTypes)', {
          pricingTypes,
        });
      }
    }

    if (typeof query.active === 'boolean') {
      qb.andWhere('product.active = :active', { active: query.active });
    }

    const sortOption = query.sort ?? ProductSortOption.NEWEST;
    switch (sortOption) {
      case ProductSortOption.DOWNLOADS:
        qb.orderBy('product.downloadsCount', 'DESC');
        break;
      case ProductSortOption.LIKES:
        qb.orderBy('product.likesCount', 'DESC');
        break;
      case ProductSortOption.POPULAR:
        qb.orderBy('product.viewsCount', 'DESC');
        break;
      case ProductSortOption.PRICE_ASC:
        qb.orderBy('product.price', 'ASC', 'NULLS LAST');
        break;
      case ProductSortOption.PRICE_DESC:
        qb.orderBy('product.price', 'DESC', 'NULLS FIRST');
        break;
      default:
        qb.orderBy('product.publishedAt', 'DESC', 'NULLS LAST');
        qb.addOrderBy('product.createdAt', 'DESC');
        break;
    }

    if (sortOption !== ProductSortOption.NEWEST) {
      qb.addOrderBy('product.publishedAt', 'DESC', 'NULLS LAST');
      qb.addOrderBy('product.createdAt', 'DESC');
    }

    return qb;
  }

  async findByIdOrSlug(idOrSlug: string): Promise<Product> {
    const whereClause = /^\d+$/.test(idOrSlug)
      ? { id: idOrSlug }
      : { slug: idOrSlug };

    const product = await this.productsRepository.findOne({
      where: whereClause,
      relations: ['categories', 'tags', 'suppliers', 'assets', 'file'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.assets) {
      product.assets.sort((a, b) => {
        const orderDelta = (a.order ?? 0) - (b.order ?? 0);
        if (orderDelta !== 0) {
          return orderDelta;
        }
        const aId = Number(a.id);
        const bId = Number(b.id);
        if (!Number.isNaN(aId) && !Number.isNaN(bId)) {
          return aId - bId;
        }
        return String(a.id).localeCompare(String(b.id));
      });
    }

    return product;
  }

  async recordView(
    product: Product,
    options: {
      currentUser?: CurrentUserPayload;
      ip?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    const { currentUser, ip, userAgent } = options;

    await this.productViewsRepository.insert({
      productId: product.id,
      userId: currentUser?.id,
      ip: ip ?? undefined,
      ua: userAgent,
    });

    void this.countersService.incrementViews(product.id);
  }

  async decorateProductWithUserState(
    product: Product,
    currentUser?: CurrentUserPayload,
  ): Promise<ProductDetailResponseDto> {
    if (!currentUser) {
      return Object.assign(product, {
        liked: false,
        bookmarked: false,
      }) as ProductDetailResponseDto;
    }

    const [liked, bookmarked] = await Promise.all([
      this.likesService.isProductLiked(currentUser.id, product.id),
      this.bookmarksService.isBookmarked(currentUser.id, product.id),
    ]);

    return Object.assign(product, {
      liked,
      bookmarked,
    }) as ProductDetailResponseDto;
  }

  async attachOrReplaceFile(
    productId: string,
    file: UploadedFile,
  ): Promise<ProductFile> {
    if (!file) {
      throw new BadRequestException('File payload is required');
    }

    const product = await this.productsRepository.findOne({
      where: { id: productId },
      relations: ['file'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existingFile = product.file
      ? await this.productFilesRepository
          .createQueryBuilder('file')
          .where('file.id = :id', { id: product.file.id })
          .addSelect('file.storageKey')
          .getOne()
      : null;

    const stored = await this.storageService.saveUploadedFile(file);

    try {
      const productFile = await this.dataSource.transaction(async (manager) => {
        const filesRepo = manager.getRepository(ProductFile);
        const productsRepo = manager.getRepository(Product);

        let record = existingFile
          ? await filesRepo.findOne({ where: { id: existingFile.id } })
          : filesRepo.create();

        if (!record) {
          record = filesRepo.create();
        }

        const fallbackSize =
          typeof file.size === 'number'
            ? file.size
            : file.buffer && Buffer.isBuffer(file.buffer)
              ? file.buffer.length
              : undefined;
        const derivedSize = stored.size ?? fallbackSize;

        record.storageKey = stored.storageKey;
        record.originalName = stored.originalName ?? file.originalname ?? undefined;
        record.size = derivedSize !== undefined ? String(derivedSize) : undefined;
        record.mimeType = stored.mimeType ?? file.mimetype ?? undefined;
        record.meta = stored.meta ?? undefined;
        record.product = product;

        const savedRecord = await filesRepo.save(record);
        product.file = savedRecord;
        await productsRepo.save(product);

        return savedRecord;
      });

      if (existingFile?.storageKey && existingFile.storageKey !== stored.storageKey) {
        await this.storageService.deleteFile(existingFile.storageKey).catch(() => undefined);
      }

      return productFile;
    } catch (error) {
      await this.storageService.deleteFile(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  async createProduct(
    dto: CreateProductDto,
    currentUser: CurrentUserPayload,
  ): Promise<Product> {
    const slug = await this.resolveUniqueSlug(dto.slug ?? slugify(dto.title));
    this.validatePricing(dto.pricingType, dto.price);

    const product = await this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const categories = await this.resolveCategories(manager, dto.categories);
      const tags = await this.resolveTags(manager, dto.tags);
      const suppliers = await this.resolveSuppliers(manager, dto.suppliers, currentUser);

      const newProduct = productRepo.create({
        slug,
        title: dto.title,
        description: dto.description,
        coverUrl: dto.coverUrl,
        pricingType: dto.pricingType,
        price: dto.price ?? null,
        active: dto.active ?? true,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        categories,
        tags,
        suppliers,
        assets: dto.assets?.map((asset, index) =>
          manager.getRepository(ProductAsset).create({
            url: asset.url,
            alt: asset.alt,
            order: asset.order ?? index,
          }),
        ),
      });

      const savedProduct = await productRepo.save(newProduct);

      if (Array.isArray(savedProduct)) {
        throw new InternalServerErrorException(
          'Unexpected array response while saving product',
        );
      }

      return savedProduct;
    });

    return this.findByIdOrSlug(product.id);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['categories', 'tags', 'suppliers', 'assets'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.slug && dto.slug !== product.slug) {
      product.slug = await this.resolveUniqueSlug(dto.slug, id);
    } else if (!dto.slug && dto.title && dto.title !== product.title) {
      product.slug = await this.resolveUniqueSlug(slugify(dto.title), id);
    }

    if (dto.pricingType ?? dto.price) {
      this.validatePricing(dto.pricingType ?? product.pricingType, dto.price ?? product.price ?? undefined);
      if (dto.pricingType) {
        product.pricingType = dto.pricingType;
      }
      if (dto.price !== undefined) {
        product.price = dto.price ?? null;
      }
    }

    if (dto.title !== undefined) {
      product.title = dto.title;
    }
    if (dto.description !== undefined) {
      product.description = dto.description;
    }
    if (dto.coverUrl !== undefined) {
      product.coverUrl = dto.coverUrl;
    }
    if (dto.active !== undefined) {
      product.active = dto.active;
    }
    if (dto.publishedAt !== undefined) {
      product.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }

    await this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);

      if (dto.categories) {
        product.categories = await this.resolveCategories(manager, dto.categories);
      }

      if (dto.tags) {
        product.tags = await this.resolveTags(manager, dto.tags);
      }

      if (dto.suppliers) {
        product.suppliers = await this.resolveSuppliers(
          manager,
          dto.suppliers,
        );
      }

      if (dto.assets) {
        const assetRepo = manager.getRepository(ProductAsset);
        product.assets = dto.assets.map((asset, index) =>
          assetRepo.create({
            url: asset.url,
            alt: asset.alt,
            order: asset.order ?? index,
          }),
        );
      }

      await productRepo.save(product);
    });

    return this.findByIdOrSlug(product.id);
  }

  async removeProduct(id: string): Promise<void> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['file', 'assets'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existingFile = product.file
      ? await this.productFilesRepository
          .createQueryBuilder('file')
          .where('file.id = :id', { id: product.file.id })
          .addSelect('file.storageKey')
          .getOne()
      : null;

    await this.productsRepository.remove(product);

    if (existingFile?.storageKey) {
      await this.storageService.deleteFile(existingFile.storageKey).catch(() => undefined);
    }
  }

  private async resolveUniqueSlug(
    baseSlug: string,
    ignoreId?: string,
  ): Promise<string> {
    if (!baseSlug) {
      throw new BadRequestException('Slug could not be generated');
    }

    for (let attempt = 0; attempt < this.slugMaxAttempts; attempt += 1) {
      const candidate = buildUniqueSlugCandidate(baseSlug, attempt);
      const existing = await this.productsRepository.findOne({
        where: { slug: candidate },
      });

      if (!existing || (ignoreId && existing.id === ignoreId)) {
        return candidate;
      }
    }

    throw new BadRequestException('Unable to generate unique slug');
  }

  private validatePricing(pricingType: PricingType, price?: string): void {
    const requiresPrice =
      pricingType === PricingType.PAID ||
      pricingType === PricingType.PAID_OR_SUBSCRIPTION;
    const forbidsPrice = pricingType === PricingType.FREE;

    if (requiresPrice && (!price || Number(price) <= 0)) {
      throw new BadRequestException(
        'Price is required for paid pricing types',
      );
    }

    if (forbidsPrice && price) {
      throw new BadRequestException('Price must be omitted for free products');
    }
  }

  private async resolveCategories(
    manager: EntityManager,
    categoryIds: Array<number | string> | undefined,
  ): Promise<Category[]> {
    if (!categoryIds?.length) {
      return [];
    }

    const categories = await manager.getRepository(Category).find({
      where: { id: In(categoryIds.map((id) => String(id))) },
    });

    if (categories.length !== categoryIds.length) {
      throw new BadRequestException('One or more categories do not exist');
    }

    return categories;
  }

  private async resolveTags(
    manager: EntityManager,
    tagIds: Array<number | string> | undefined,
  ): Promise<Tag[]> {
    if (!tagIds?.length) {
      return [];
    }

    const tags = await manager.getRepository(Tag).find({
      where: { id: In(tagIds.map((id) => String(id))) },
    });

    if (tags.length !== tagIds.length) {
      throw new BadRequestException('One or more tags do not exist');
    }

    return tags;
  }

  private async resolveSuppliers(
    manager: EntityManager,
    supplierIds: Array<number | string> | undefined,
    currentUser?: CurrentUserPayload,
  ): Promise<User[]> {
    if (supplierIds === undefined) {
      if (!currentUser) {
        throw new BadRequestException('Suppliers are required');
      }

      if (isSupplier(currentUser)) {
        return [await this.requireSupplierRecord(manager, currentUser.id)];
      }

      if (isAdmin(currentUser)) {
        throw new BadRequestException(
          'At least one supplier must be specified',
        );
      }

      return [];
    }

    if (supplierIds.length === 0) {
      return [];
    }

    const suppliers = await manager.getRepository(User).find({
      where: { id: In(supplierIds.map((id) => String(id))) },
    });

    if (suppliers.length !== supplierIds.length) {
      throw new BadRequestException('One or more suppliers do not exist');
    }

    return suppliers;
  }

  private async requireSupplierRecord(
    manager: EntityManager,
    userId: string,
  ): Promise<User> {
    const supplier = await manager.getRepository(User).findOne({
      where: { id: userId },
    });
    if (!supplier) {
      throw new BadRequestException('Supplier does not exist');
    }
    return supplier;
  }
}



