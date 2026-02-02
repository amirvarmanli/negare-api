import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '@app/common/decorators/current-user.decorator';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { requireUserId } from '@app/catalog/utils/current-user.util';

import { ProductManagementService } from '@app/catalog/product/product-management.service';
import { ProductManagementQueryDto } from '@app/catalog/product/dtos/product-management-query.dto';
import { CreateProductDto } from '@app/catalog/product/dtos/product-create.dto';
import { UpdateProductDto } from '@app/catalog/product/dtos/product-update.dto';
import {
  ProductDetailDto,
  ProductManagementPaginatedResultDto,
} from '@app/catalog/product/dtos/product-response.dto';
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

@ApiTags('Supplier - Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('supplier/products')
export class SupplierProductsController {
  constructor(private readonly service: ProductManagementService) {}

  @Get()
  @Permissions('supplier.products:read')
  @ApiOperation({
    summary: 'List products (supplier-owned only, includes drafts/pending approval)',
  })
  @ApiOkResponse({ type: ProductManagementPaginatedResultDto })
  async list(
    @Query() query: ProductManagementQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductManagementPaginatedResultDto> {
    const ownerId = requireUserId(user);
    return this.service.list({ type: 'owner', ownerId }, query);
  }

  @Get(':id/download')
  @Permissions('supplier.products:read')
  @ApiOperation({ summary: 'Download product file (supplier-owned)' })
  @ApiParam({ name: 'id', description: 'Product id (BigInt as string) or slug' })
  @ApiProduces('application/octet-stream')
  @ApiHeader({
    name: 'Content-Disposition',
    description: 'attachment; filename="<safe-filename>"',
  })
  @ApiOkResponse({ description: 'File download stream.' })
  async downloadFile(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const ownerId = requireUserId(user);
    const download = await this.service.downloadFile(id, {
      id: ownerId,
      isAdmin: false,
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
  @Permissions('supplier.products:read')
  @ApiOperation({ summary: 'Get product by id or slug (supplier-owned only)' })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiParam({ name: 'id', description: 'Product id (BigInt as string) or slug' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto> {
    const ownerId = requireUserId(user);
    return this.service.findOne({ type: 'owner', ownerId }, id);
  }

  @Post()
  @Permissions('supplier.products:manage')
  @ApiOperation({ summary: 'Create a product (supplier-owned)' })
  @ApiCreatedResponse({ type: ProductDetailDto })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto> {
    const ownerId = requireUserId(user);
    return this.service.create(
      { type: 'owner', ownerId },
      dto,
      { id: ownerId, isAdmin: false },
    );
  }

  @Patch(':id')
  @Permissions('supplier.products:manage')
  @ApiOperation({ summary: 'Update a product (supplier-owned)' })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiParam({ name: 'id', description: 'Product id (BigInt as string) or slug' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ProductDetailDto> {
    const ownerId = requireUserId(user);
    return this.service.update(
      { type: 'owner', ownerId },
      id,
      dto,
      { id: ownerId, isAdmin: false },
    );
  }

  @Delete(':id')
  @Permissions('supplier.products:manage')
  @ApiOperation({ summary: 'Archive a product (supplier-owned)' })
  @ApiNoContentResponse()
  @ApiParam({ name: 'id', description: 'Product id (BigInt as string) or slug' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<void> {
    const ownerId = requireUserId(user);
    await this.service.archive({ type: 'owner', ownerId }, id);
  }
}
