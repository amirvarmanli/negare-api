import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  ForbiddenException,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { Public } from '@app/common/decorators/public.decorator';

import { ProductService, Actor } from '@app/catalog/product/product.service';
import { CreateProductDto } from '@app/catalog/product/dtos/product-create.dto';
import { UpdateProductDto } from '@app/catalog/product/dtos/product-update.dto';
import {
  ProductFindQueryDto,
  ProductRelatedQueryDto,
  ProductSearchQueryDto,
} from '@app/catalog/product/dtos/product-query.dto';
import {
  ProductBriefDto,
  ProductDetailDto,
  ProductListResultDto,
  ProductPaginatedResultDto,
  ProductSearchResultDto,
} from '@app/catalog/product/dtos/product-response.dto';
import { ProductIdParamDto } from '@app/catalog/product/dtos/product-id.dto';
import { UserProductListQueryDto } from '@app/catalog/product/dtos/product-user-list-query.dto';
import { LikeToggleResponseDto } from '@app/catalog/likes/dtos/like-toggle.dto';
import { BookmarkToggleResponseDto } from '@app/catalog/bookmarks/dtos/bookmark-toggle.dto';
import { requireUserId } from '@app/catalog/utils/current-user.util';

function requireActor(user: CurrentUserPayload | undefined): Actor {
  if (!user) {
    throw new ForbiddenException('Authentication required.');
  }
  return {
    id: user.id,
    isAdmin: Boolean(user.roles?.includes(RoleName.admin)),
  };
}

@ApiTags('Catalog / Products')
@Controller('catalog/products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  private readonly logger = new Logger(ProductController.name);

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Either link an uploaded file via fileId (UUID from upload/finish) or provide inline file payload to create one.',
  })
  @ApiCreatedResponse({ type: ProductDetailDto })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto> {
    const actor = requireActor(user);
    return this.service.create(dto, actor);
  }

  @Patch(':idOrSlug')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a product (partial)',
    description:
      'Supports switching ProductFile via uploaded fileId, creating a new file inline, or disconnecting the current file (fileId: null).',
  })
  @ApiOkResponse({ type: ProductDetailDto })
  async update(
    @Param() params: ProductIdParamDto,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto> {
    const actor = requireActor(user);
    return this.service.update(params.idOrSlug, dto, actor);
  }

  @Get('id/:id')
  @Public()
  @ApiOperation({ summary: 'Get a product by numeric id' })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiParam({ name: 'id', example: '1001', description: 'Product id' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto> {
    const viewerId = user?.id;
    return this.service.findByIdOrSlug(id, viewerId);
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search products by title and tags' })
  @ApiOkResponse({ type: ProductSearchResultDto })
  async search(
    @Query() q: ProductSearchQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductSearchResultDto> {
    return this.service.search(q, user?.id);
  }

  @Get('short/:code')
  @Public()
  @ApiOperation({ summary: 'Resolve a product by short link code' })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiParam({
    name: 'code',
    example: '571950',
    description: 'Short product code (with or without "p/" prefix)',
  })
  async findByShortCode(
    @Param('code') code: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto> {
    return this.service.findByShortCode(code, user?.id);
  }

  @Get('liked')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List liked products of current user' })
  @ApiOkResponse({ type: ProductPaginatedResultDto })
  async listLiked(
    @Query() q: UserProductListQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductPaginatedResultDto> {
    const userId = requireUserId(user);
    return this.service.listLikedByUser(userId, q);
  }

  @Get('bookmarked')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List bookmarked products of current user' })
  @ApiOkResponse({ type: ProductPaginatedResultDto })
  async listBookmarked(
    @Query() q: UserProductListQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductPaginatedResultDto> {
    const userId = requireUserId(user);
    return this.service.listBookmarkedByUser(userId, q);
  }

  @Get(':idOrSlug/related')
  @Public()
  @ApiOperation({
    summary: 'Get related products for a given product based on shared tags',
  })
  @ApiOkResponse({ type: ProductBriefDto, isArray: true })
  @ApiParam({
    name: 'idOrSlug',
    example: 'modern-logo-pack',
    description: 'Product slug or numeric id',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 12,
    description: 'Max items to return (default 12, max 24)',
  })
  async findRelated(
    @Param() params: ProductIdParamDto,
    @Query() q: ProductRelatedQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductBriefDto[]> {
    return this.service.findRelated(params.idOrSlug, q.limit, user?.id);
  }

  @Get(':idOrSlug')
  @Public()
  @ApiOperation({
    summary: 'Get a product by slug (Persian-safe)',
    description:
      'Accepts a product slug (Persian-safe) or numeric id, normalizes slugs, and redirects (301) when an old slug is used.',
  })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiResponse({
    status: 301,
    description: 'Redirect to the canonical slug when an old slug is used',
  })
  @ApiParam({
    name: 'idOrSlug',
    example: 'modern-logo-pack',
    description: 'Product slug (Persian-safe) or numeric id',
  })
  async findByIdOrSlug(
    @Param() params: ProductIdParamDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request & { user?: { id: string } },
  ): Promise<ProductDetailDto | undefined> {
    const viewerId = req.user?.id ?? undefined;
    this.logger.debug({
      context: 'ProductDetailFlags',
      step: 'controller',
      idOrSlug: params.idOrSlug,
      viewerId,
    });
    const result = await this.service.findForRoute(params.idOrSlug, viewerId);
    if (result.redirectTo) {
      res.redirect(
        HttpStatus.MOVED_PERMANENTLY,
        `/catalog/products/${encodeURIComponent(result.redirectTo)}`,
      );
      return undefined;
    }
    return result.product;
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List products (cursor-based "Load more")',
    description:
      'Supports filters (q, categoryId, tagId, tagSlug, topicId, topicSlug, authorId, pricingType, graphicFormat, status, color, hasFile, hasAssets) and sort (latest|popular|viewed|liked).',
  })
  @ApiOkResponse({ type: ProductListResultDto })
  async findAll(
    @Query() q: ProductFindQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductListResultDto> {
    return this.service.findAll(q, user?.id);
  }

  @Delete(':idOrSlug')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a product (soft remove)' })
  @ApiOkResponse({ type: ProductDetailDto })
  async remove(
    @Param() params: ProductIdParamDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto> {
    const actor = requireActor(user);
    return this.service.remove(params.idOrSlug, actor);
  }

  @Post(':id/like')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle product like' })
  @ApiOkResponse({ type: LikeToggleResponseDto })
  @ApiParam({
    name: 'id',
    description: 'Product id (numeric string)',
    example: '1001',
  })
  async toggleLike(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<LikeToggleResponseDto> {
    const actor = requireActor(user);
    return this.service.toggleLike(id, actor.id);
  }

  @Post(':id/bookmark')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle product bookmark' })
  @ApiOkResponse({ type: BookmarkToggleResponseDto })
  @ApiParam({
    name: 'id',
    description: 'Product id (numeric string)',
    example: '1001',
  })
  async toggleBookmark(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<BookmarkToggleResponseDto> {
    const actor = requireActor(user);
    return this.service.toggleBookmark(id, actor.id);
  }

  @Post(':id/download')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a download and increment counts' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async registerDownload(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Ip() ip: string,
  ): Promise<void> {
    const actor = requireActor(user);
    await this.service.registerDownload(id, actor.id, undefined, undefined, ip);
  }

  @Post(':id/view')
  @Public()
  @ApiOperation({ summary: 'Increment a view (public endpoint)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async incrementViewPublic(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ): Promise<void> {
    const viewerId: string | undefined = user?.id;
    await this.service.incrementView(BigInt(id), viewerId, ip, ua);
  }
}
