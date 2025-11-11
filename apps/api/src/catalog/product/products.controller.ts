import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  ForbiddenException,
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
} from '@nestjs/swagger';
import { Response } from 'express';
import { RoleName } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { Public } from '@app/common/decorators/public.decorator';

import { ProductService, Actor } from '@app/catalog/product/product.service';
import { CreateProductDto } from '@app/catalog/product/dtos/product-create.dto';
import { UpdateProductDto } from '@app/catalog/product/dtos/product-update.dto';
import { ProductFindQueryDto } from '@app/catalog/product/dtos/product-query.dto';
import {
  ProductBriefDto,
  ProductDetailDto,
  ProductListResultDto,
} from '@app/catalog/product/dtos/product-response.dto';
import { ProductIdParamDto } from '@app/catalog/product/dtos/product-id.dto';
import {
  normalizeFaText,
  safeDecodeSlug,
} from '@shared-slug/slug/fa-slug.util';

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

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Either connect an existing ProductFile using fileId or provide file payload to create one inline.',
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
      'Supports switching ProductFile via fileId, creating a new file inline, or disconnecting the current file (fileId: null).',
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

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get a product by slug (Persian-safe)',
    description:
      'Decodes and normalizes the slug, returning a 301 redirect when the slug changed.',
  })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiResponse({
    status: 301,
    description: 'Redirect to the canonical slug when an old slug is used',
  })
  @ApiParam({
    name: 'slug',
    example: 'نقاشی-و-تصویرسازی',
    description: 'Product slug',
  })
  async findBySlug(
    @Param('slug') slugParam: string,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto | undefined> {
    const normalized = normalizeFaText(safeDecodeSlug(slugParam));
    const result = await this.service.findBySlug(normalized, user?.id);
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
      'Supports filters (q, categoryId, tagId, topicId, authorId, pricingType, graphicFormat, status, color, hasFile, hasAssets) and sort (latest|popular|viewed|liked).',
  })
  @ApiOkResponse({ type: ProductListResultDto })
  async findAll(
    @Query() q: ProductFindQueryDto,
  ): Promise<ProductListResultDto> {
    return this.service.findAll(q);
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
  @ApiOperation({ summary: 'Toggle like for current user' })
  @ApiOkResponse({ schema: { properties: { liked: { type: 'boolean' } } } })
  async toggleLike(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ) {
    const actor = requireActor(user);
    return this.service.toggleLike(id, actor.id);
  }

  @Post(':id/bookmark')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle bookmark for current user' })
  @ApiOkResponse({
    schema: { properties: { bookmarked: { type: 'boolean' } } },
  })
  async toggleBookmark(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ) {
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
