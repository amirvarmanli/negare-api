import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '@app/common/decorators/current-user.decorator';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { requireUserId } from '@app/catalog/utils/current-user.util';

import { ProductManagementService } from '@app/catalog/product/product-management.service';
import { AdminProductsService } from '@app/catalog/product/admin-products.service';
import {
  AdminProductsListQueryDto,
  AdminProductsMineQueryDto,
  AdminProductSaleType,
} from '@app/catalog/product/dtos/admin-products-query.dto';
import { AdminProductsListResponseDto } from '@app/catalog/product/dtos/admin-products-list.dto';
import { AdminProductCreateDto } from '@app/catalog/product/dtos/product-admin-create.dto';
import { UpdateProductDto } from '@app/catalog/product/dtos/product-update.dto';
import { AdminProductUpdateDto } from '@app/catalog/product/dtos/admin-product-update.dto';
import { ProductDetailDto } from '@app/catalog/product/dtos/product-response.dto';
import { AdminProductBumpRequestDto, AdminProductBumpResponseDto } from '@app/catalog/product/dtos/admin-product-bump.dto';
import { PricingType } from '@prisma/client';
import type { Response } from 'express';

function sanitizeFilename(value: string): string {
  return value
    .replace(/[\r\n"]/gu, '')
    .replace(/[^\x20-\x7E]/gu, '_')
    .trim() || 'download';
}

function buildContentDisposition(filename: string): string {
  const safe = sanitizeFilename(filename);
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

@ApiTags('Admin - Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly service: ProductManagementService,
    private readonly adminProductsService: AdminProductsService,
  ) {}

  @Get()
  @Permissions('admin.products:read')
  @ApiOperation({ summary: 'List products (admin panel)' })
  @ApiOkResponse({ type: AdminProductsListResponseDto })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (min 1, defaults to 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Page size (min 1, max 100, defaults to 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search across product title/slug/id and artist name/username',
    example: 'amir',
  })
  @ApiQuery({
    name: 'publishStatus',
    required: false,
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    example: '{{categoryId}}',
  })
  @ApiQuery({
    name: 'topicId',
    required: false,
    example: '{{topicId}}',
  })
  @ApiQuery({
    name: 'saleType',
    required: false,
    enum: ['FREE', 'PAID', 'SUBSCRIPTION'],
  })
  @ApiQuery({
    name: 'artistId',
    required: false,
    example: '{{artistId}}',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'price', 'title'],
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  async list(
    @Query() query: AdminProductsListQueryDto,
  ): Promise<AdminProductsListResponseDto> {
    return this.adminProductsService.list(query);
  }

  @Get('mine')
  @Permissions('admin.products:read')
  @ApiOperation({ summary: 'List my products (admin panel)' })
  @ApiOkResponse({ type: AdminProductsListResponseDto })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (min 1, defaults to 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Page size (min 1, max 100, defaults to 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search across product title/slug/id',
    example: 'brand',
  })
  @ApiQuery({
    name: 'publishStatus',
    required: false,
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    example: '{{categoryId}}',
  })
  @ApiQuery({
    name: 'topicId',
    required: false,
    example: '{{topicId}}',
  })
  @ApiQuery({
    name: 'saleType',
    required: false,
    enum: ['FREE', 'PAID', 'SUBSCRIPTION'],
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'price', 'title'],
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  async listMine(
    @Query() query: AdminProductsMineQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<AdminProductsListResponseDto> {
    const userId = requireUserId(user);
    return this.adminProductsService.listMine(userId, query);
  }

  @Get(':id/download')
  @Permissions('admin.products:read')
  @ApiOperation({ summary: 'Download product file (admin)' })
  @ApiParam({ name: 'id', description: 'Product id (BigInt as string) or slug' })
  @ApiProduces('application/octet-stream')
  @ApiHeader({
    name: 'Content-Disposition',
    description: 'attachment; filename="<safe-filename>"',
  })
  @ApiOkResponse({
    description: 'File download stream.',
  })
  async downloadFile(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = requireUserId(user);
    const download = await this.service.downloadFile(id, {
      id: userId,
      isAdmin: true,
    });

    download.stream.once('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (!res.headersSent) {
        if (code === 'ENOENT') {
          res.status(404).json({ message: 'File not found.' });
        } else {
          res.status(500).json({ message: 'Download failed.' });
        }
      } else {
        res.end();
      }
    });

    res.setHeader(
      'Content-Disposition',
      buildContentDisposition(download.filename),
    );
    res.setHeader(
      'Content-Type',
      download.mimeType ?? 'application/octet-stream',
    );
    if (download.size !== undefined) {
      res.setHeader('Content-Length', String(download.size));
    }

    return new StreamableFile(download.stream);
  }

  @Get(':id')
  @Permissions('admin.products:read')
  @ApiOperation({ summary: 'Get product by id or slug (admin)' })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiParam({ name: 'id', description: 'Product id (BigInt as string) or slug' })
  async findOne(@Param('id') id: string): Promise<ProductDetailDto> {
    return this.service.findOne({ type: 'admin' }, id);
  }

  @Post()
  @Permissions('admin.products:manage')
  @ApiOperation({ summary: 'Create a product (admin)' })
  @ApiCreatedResponse({ type: ProductDetailDto })
  async create(
    @Body() dto: AdminProductCreateDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto> {
    const userId = requireUserId(user);
    return this.service.create(
      { type: 'admin' },
      dto,
      { id: userId, isAdmin: true },
    );
  }

  @Patch(':id')
  @Permissions('admin.products:manage')
  @ApiOperation({ summary: 'Update a product (admin)' })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiParam({ name: 'id', description: 'Product id (BigInt as string) or slug' })
  async update(
    @Param('id') id: string,
    @Body() dto: AdminProductUpdateDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto> {
    const userId = requireUserId(user);
    const normalized = this.normalizeAdminUpdateDto(dto);
    return this.service.update(
      { type: 'admin' },
      id,
      normalized,
      { id: userId, isAdmin: true },
    );
  }

  @Post(':id/bump')
  @Permissions('admin.products:manage')
  @ApiOperation({ summary: 'Bump a product to the top (admin)' })
  @ApiBody({ type: AdminProductBumpRequestDto, required: false })
  @ApiOkResponse({ type: AdminProductBumpResponseDto })
  @ApiParam({ name: 'id', description: 'Product id (BigInt as string) or slug' })
  @HttpCode(HttpStatus.OK)
  async bump(
    @Param('id') id: string,
    @Body() _dto: AdminProductBumpRequestDto,
  ): Promise<AdminProductBumpResponseDto> {
    return this.adminProductsService.bump(id);
  }

  @Delete(':id')
  @Permissions('admin.products:manage')
  @ApiOperation({ summary: 'Archive a product (admin)' })
  @ApiNoContentResponse()
  @ApiParam({ name: 'id', description: 'Product id (BigInt as string) or slug' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.archive({ type: 'admin' }, id);
  }

  private normalizeAdminUpdateDto(dto: AdminProductUpdateDto): UpdateProductDto {
    const { publishStatus, saleType, ...rest } = dto;
    const normalized: UpdateProductDto = { ...rest };

    if (publishStatus !== undefined) {
      if (dto.status && dto.status !== publishStatus) {
        throw new BadRequestException('publishStatus and status must match.');
      }
      normalized.status = publishStatus;
    }

    if (saleType !== undefined) {
      const mapped = this.mapSaleTypeToPricingType(saleType);
      if (dto.pricingType && dto.pricingType !== mapped) {
        throw new BadRequestException('saleType and pricingType must match.');
      }
      normalized.pricingType = mapped;

      if (saleType === AdminProductSaleType.PAID) {
        if (dto.price === undefined || dto.price === null || dto.price <= 0) {
          throw new BadRequestException(
            'price must be a positive integer for PAID products.',
          );
        }
      } else {
        if (dto.price !== undefined && dto.price !== null && dto.price !== 0) {
          throw new BadRequestException(
            'price must be null for non-PAID products.',
          );
        }
        normalized.price = null;
      }
    }

    return normalized;
  }

  private mapSaleTypeToPricingType(value: AdminProductSaleType): PricingType {
    if (value === AdminProductSaleType.SUBSCRIPTION) {
      return PricingType.PAID_OR_SUBSCRIPTION;
    }
    return value as PricingType;
  }
}
