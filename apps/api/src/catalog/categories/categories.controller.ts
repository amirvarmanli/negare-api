import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { Roles } from '@app/common/decorators/roles.decorator';
import {
  normalizeFaText,
  safeDecodeSlug,
} from '@shared-slug/slug/fa-slug.util';

import { CategoriesService } from '@app/catalog/categories/categories.service';
import { CreateCategoryDto } from '@app/catalog/categories/dtos/category-create.dto';
import { UpdateCategoryDto } from '@app/catalog/categories/dtos/category-update.dto';
import { CategoryFindQueryDto } from '@app/catalog/categories/dtos/category-query.dto';
import {
  CategoryDto,
  CategoryListResultDto,
  CategoryTreeNodeDto,
  CategoryBreadcrumbDto,
} from '@app/catalog/categories/dtos/category-response.dto';
import { Public } from '@app/common/decorators/public.decorator';

@ApiTags('Catalog / Categories')
@Controller('catalog/categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ type: CategoryDto })
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Update a category' })
  @ApiOkResponse({ type: CategoryDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.service.update(id, dto);
  }

  @Get('id/:id')
  @Public()
  @ApiOperation({ summary: 'Find category by numeric id' })
  @ApiOkResponse({ type: CategoryDto })
  @ApiParam({ name: 'id', example: '42', description: 'Category id' })
  async findById(@Param('id') id: string): Promise<CategoryDto> {
    return this.service.findById(id);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List categories (flat)' })
  @ApiOkResponse({ type: CategoryListResultDto })
  async findAll(
    @Query() q: CategoryFindQueryDto,
  ): Promise<CategoryListResultDto> {
    return this.service.findAll(q);
  }

  @Get('tree/root')
  @Public()
  @ApiOperation({ summary: 'Get full category tree (all roots)' })
  @ApiOkResponse({ type: [CategoryTreeNodeDto] })
  async treeAll(): Promise<CategoryTreeNodeDto[]> {
    return this.service.tree();
  }

  @Get('tree/:rootId')
  @Public()
  @ApiOperation({ summary: 'Get a subtree rooted at :rootId' })
  @ApiOkResponse({ type: [CategoryTreeNodeDto] })
  async tree(@Param('rootId') rootId: string): Promise<CategoryTreeNodeDto[]> {
    return this.service.tree(rootId);
  }

  @Get(':id/breadcrumbs/path')
  @Public()
  @ApiOperation({ summary: 'Get breadcrumbs path for a category (root..self)' })
  @ApiOkResponse({ type: CategoryBreadcrumbDto })
  async breadcrumbs(@Param('id') id: string): Promise<CategoryBreadcrumbDto> {
    return this.service.breadcrumbs(id);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Find category by slug (supports Persian characters)',
    description:
      'Automatically decodes/normalizes the slug and issues a 301 redirect when the slug has changed.',
  })
  @ApiOkResponse({ type: CategoryDto })
  @ApiResponse({
    status: 301,
    description: 'Redirect to the canonical slug when obsolete slug is used',
  })
  @ApiParam({
    name: 'slug',
    example: 'نقاشی-و-تصویرسازی',
    description: 'Canonical Persian slug',
  })
  async findBySlug(
    @Param('slug') slugParam: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CategoryDto | undefined> {
    const normalizedSlug = normalizeFaText(safeDecodeSlug(slugParam));
    const result = await this.service.findBySlug(normalizedSlug);
    if (result.redirectTo) {
      res.redirect(
        HttpStatus.MOVED_PERMANENTLY,
        `/catalog/categories/${encodeURIComponent(result.redirectTo)}`,
      );
      return undefined;
    }
    return result.category;
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Delete a category (relink children to parent)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
