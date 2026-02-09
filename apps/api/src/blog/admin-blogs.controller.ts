import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { BlogService } from '@app/blog/blog.service';
import { AdminBlogsListQueryDto } from '@app/blog/dto/admin-blogs-list-query.dto';
import { BlogAdminListResponseDto } from '@app/blog/dto/admin-blogs-list-item.dto';
import { BlogAdminDetailDto } from '@app/blog/dto/admin-blog-detail.dto';
import { AdminUpdateBlogDto } from '@app/blog/dto/admin-update-blog.dto';
import { AdminRejectDto } from '@app/blog/dto/admin-reject.dto';
import { CreateBlogPostDto } from '@app/blog/dto/create-blog-post.dto';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '@app/common/decorators/current-user.decorator';
import { Roles } from '@app/common/decorators/roles.decorator';

@ApiTags('Admin Blogs')
@ApiBearerAuth()
@Controller('admin/blogs')
@UseGuards(JwtAuthGuard)
@Roles(RoleName.admin)
export class AdminBlogsController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @ApiOperation({
    summary: 'List all blogs with filters and pagination (admin only)',
  })
  @ApiOkResponse({ type: BlogAdminListResponseDto })
  async list(
    @Query() query: AdminBlogsListQueryDto,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<BlogAdminListResponseDto> {
    return this.blogService.adminListAllPosts(query, currentUser);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a blog post (admin only)',
    description: 'Defaults to DRAFT when status is omitted.',
  })
  @ApiOkResponse({ type: BlogAdminDetailDto })
  async create(
    @Body() dto: CreateBlogPostDto,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<BlogAdminDetailDto> {
    return this.blogService.adminCreatePost(dto, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a blog post by ID (admin only)' })
  @ApiOkResponse({ type: BlogAdminDetailDto })
  async getById(
    @Param('id') id: string,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<BlogAdminDetailDto> {
    return this.blogService.adminGetPost(id, currentUser);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a blog post (admin only)' })
  @ApiOkResponse({ type: BlogAdminDetailDto })
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateBlogDto,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<BlogAdminDetailDto> {
    return this.blogService.adminUpdatePost(id, dto, currentUser);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Soft-delete a blog post (admin only)',
    description:
      'Soft delete sets deletedAt and forces status=ARCHIVED with archivedAt.',
  })
  @ApiNoContentResponse()
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<void> {
    await this.blogService.adminSoftDeletePost(id, currentUser);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a blog post' })
  @ApiOkResponse({ type: BlogAdminDetailDto })
  async approve(
    @Param('id') id: string,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<BlogAdminDetailDto> {
    return this.blogService.adminApprovePost(id, currentUser);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a blog post' })
  @ApiOkResponse({ type: BlogAdminDetailDto })
  async reject(
    @Param('id') id: string,
    @Body() dto: AdminRejectDto,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<BlogAdminDetailDto> {
    return this.blogService.adminRejectPost(id, dto, currentUser);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a blog post' })
  @ApiOkResponse({ type: BlogAdminDetailDto })
  async archive(
    @Param('id') id: string,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<BlogAdminDetailDto> {
    return this.blogService.adminArchivePost(id, currentUser);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Unarchive a blog post' })
  @ApiOkResponse({ type: BlogAdminDetailDto })
  async unarchive(
    @Param('id') id: string,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<BlogAdminDetailDto> {
    return this.blogService.adminUnarchivePost(id, currentUser);
  }
}
