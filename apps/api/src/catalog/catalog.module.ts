import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { Product } from './entities/content/product.entity';
import { ProductAsset } from './entities/content/product-asset.entity';
import { ProductFile } from './entities/content/product-file.entity';
import { Category } from './entities/content/category.entity';
import { Tag } from './entities/content/tag.entity';
import { Like } from './entities/content/like.entity';
import { Bookmark } from './entities/content/bookmark.entity';
import { ProductView } from './entities/analytics/product-view.entity';
import { ProductDownload } from './entities/analytics/product-download.entity';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { TagsController } from './tags/tags.controller';
import { TagsService } from './tags/tags.service';
import {
  LikesController,
  ProfileLikesController,
} from './likes/likes.controller';
import { LikesService } from './likes/likes.service';
import {
  BookmarksController,
  ProfileBookmarksController,
} from './bookmarks/bookmarks.controller';
import { BookmarksService } from './bookmarks/bookmarks.service';
import { DownloadsController } from './downloads/downloads.controller';
import { DownloadsService } from './downloads/downloads.service';
import { SupplierOwnershipGuard } from './guards/supplier-ownership.guard';
import { CountersService } from './counters/counters.service';
import { User } from '../core/users/user.entity';
import { StorageService } from './storage/storage.service';
import { LocalStorageService } from './storage/local-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductAsset,
      ProductFile,
      Category,
      Tag,
      Like,
      Bookmark,
      ProductView,
      ProductDownload,
      User,
    ]),
  ],
  controllers: [
    ProductsController,
    CategoriesController,
    TagsController,
    LikesController,
    ProfileLikesController,
    BookmarksController,
    ProfileBookmarksController,
    DownloadsController,
  ],
  providers: [
    ProductsService,
    CategoriesService,
    TagsService,
    LikesService,
    BookmarksService,
    DownloadsService,
    SupplierOwnershipGuard,
    CountersService,
    { provide: StorageService, useClass: LocalStorageService },
  ],
  exports: [ProductsService],
})
export class CatalogModule {}
