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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { CategoriesService } from '@app/catalog/categories/categories.service';
import { CreateCategoryDto } from '@app/catalog/categories/dtos/category-create.dto';
import { UpdateCategoryDto } from '@app/catalog/categories/dtos/category-update.dto';
import {
  CategoryDto,
  CategoryTreeNodeDto,
} from '@app/catalog/categories/dtos/category-response.dto';
import { CategoryReorderDto } from '@app/catalog/categories/dtos/category-reorder.dto';

@ApiTags('Admin - Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('admin.categories:manage')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List categories tree (admin)' })
  @ApiOkResponse({ type: [CategoryTreeNodeDto] })
  async findAll(): Promise<CategoryTreeNodeDto[]> {
    return this.service.tree();
  }

  @Post()
  @ApiOperation({ summary: 'Create a category (admin)' })
  @ApiCreatedResponse({ type: CategoryDto })
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.service.create(dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder categories (admin)' })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorder(@Body() dto: CategoryReorderDto): Promise<void> {
    await this.service.reorder(dto.parentId, dto.orderedIds);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by id (admin)' })
  @ApiOkResponse({ type: CategoryDto })
  @ApiParam({ name: 'id', description: 'Category id (BigInt as string)' })
  async findById(@Param('id') id: string): Promise<CategoryDto> {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category (admin)' })
  @ApiOkResponse({ type: CategoryDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category (admin)' })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
