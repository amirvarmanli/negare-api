import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { Category } from '../entities/content/category.entity';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@app/common/guards/roles.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { RoleName } from '@app/core/roles/entities/role.entity';

@ApiTags('Catalog Categories')
@Controller('catalog/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'List categories',
    description: 'Returns all categories with hierarchical relationships.',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories fetched successfully.',
    type: Category,
    isArray: true,
  })
  findAll(): Promise<Category[]> {
    return this.categoriesService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @ApiBearerAuth()
  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Create category',
    description: 'Creates a new category within the catalog hierarchy.',
  })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully.',
    type: Category,
  })
  create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoriesService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @ApiBearerAuth()
  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Update category',
    description: 'Updates an existing category metadata.',
  })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully.',
    type: Category,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @ApiBearerAuth()
  @ApiCookieAuth('refresh_token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete category',
    description: 'Removes a category by identifier.',
  })
  @ApiResponse({
    status: 204,
    description: 'Category removed successfully.',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.categoriesService.remove(id);
  }
}
