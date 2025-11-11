// apps/api/src/catalog/catalog.module.ts
import { Module } from '@nestjs/common';

// Product
import { ProductController } from '@app/catalog/product/products.controller';
import { ProductService } from '@app/catalog/product/product.service';

// Categories
import { CategoriesController } from '@app/catalog/categories/categories.controller';
import { CategoriesService } from '@app/catalog/categories/categories.service';

// Tags & Topics
import { TagsController } from '@app/catalog/tags/tags.controller';
import { TagsService } from '@app/catalog/tags/tags.service';
import { TopicsController } from '@app/catalog/topics/topics.controller';
import { TopicsService } from '@app/catalog/topics/topics.service';

// Likes
import { LikesController } from '@app/catalog/likes/likes.controller';
import { ProfileLikesController } from '@app/catalog/likes/profile-likes.controller';
import { LikesService } from '@app/catalog/likes/likes.service';

// Bookmarks
import { BookmarksController } from '@app/catalog/bookmarks/bookmarks.controller';
import { ProfileBookmarksController } from '@app/catalog/bookmarks/profile-bookmarks.controller';
import { BookmarksService } from '@app/catalog/bookmarks/bookmarks.service';

// Downloads
import { DownloadsController } from '@app/catalog/downloads/downloads.controller';
import { ProfileDownloadsController } from '@app/catalog/downloads/profile-downloads.controller';
import { DownloadsService } from '@app/catalog/downloads/downloads.service';

// Guards / Counters
import { SupplierOwnershipGuard } from '@app/catalog/guards/supplier-ownership.guard';
import { CountersService } from '@app/catalog/counters/counters.service';

// Storage (فعلاً داخل همین ماژول؛ اگر به core بردی، StorageModule رو import کن)
import { StorageService } from '@app/catalog/storage/storage.service';
import { LocalStorageService } from '@app/catalog/storage/local-storage.service';

// Comments
import { CommentsController } from '@app/catalog/comments/comments.controller';
import { CommentsService } from '@app/catalog/comments/comments.service';

@Module({
  imports: [
    // اگر Storage را به core منتقل کردی:
    // StorageModule,
    // و همچنین اگر PrismaModule داری:
    // PrismaModule,
  ],
  controllers: [
    ProductController,
    CategoriesController,
    TagsController,
    TopicsController,
    LikesController,
    ProfileLikesController,
    BookmarksController,
    ProfileBookmarksController,
    DownloadsController,
    ProfileDownloadsController,
    CommentsController,
  ],
  providers: [
    ProductService,
    CategoriesService,
    TagsService,
    TopicsService,
    LikesService,
    BookmarksService,
    DownloadsService,
    SupplierOwnershipGuard,
    CountersService,
    CommentsService,
    // اگر Storage به core نرفته:
    { provide: StorageService, useClass: LocalStorageService },
  ],
  exports: [
    // هرکدام را که بیرون از Catalog نیاز داری:
    ProductService,
    CategoriesService,
    TagsService,
    TopicsService,
    LikesService,
    BookmarksService,
    DownloadsService,
    CommentsService,
    CountersService,
    StorageService, // اگر اینجا بایند کردی
  ],
})
export class CatalogModule {}
