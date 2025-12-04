import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BlogService } from '@app/blog/blog.service';
import {
  BlogPostDto,
  BlogPostListResponseDto,
} from '@app/blog/dto/blog-post.dto';
import { BlogAdminPostsQueryDto } from '@app/blog/dto/blog-posts-query.dto';
import { CreateBlogPostDto } from '@app/blog/dto/create-blog-post.dto';
import { UpdateBlogPostDto } from '@app/blog/dto/update-blog-post.dto';
import { BlogCommentListResponseDto, BlogCommentDto } from '@app/blog/dto/blog-comment.dto';
import { BlogAdminCommentsQueryDto } from '@app/blog/dto/blog-comments-query.dto';
import { UpdateBlogCommentStatusDto } from '@app/blog/dto/update-blog-comment-status.dto';
import { CreateBlogCategoryDto } from '@app/blog/dto/create-blog-category.dto';
import { BlogCategoryDto } from '@app/blog/dto/blog-category.dto';
import { UpdateBlogCategoryDto } from '@app/blog/dto/update-blog-category.dto';
import { UpdateBlogPinStatusDto } from '@app/blog/dto/update-blog-pin-status.dto';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';

function requireAuthenticatedUser(
  user: CurrentUserPayload | undefined,
): string {
  if (!user) {
    throw new ForbiddenException('Authentication required');
  }
  return user.id;
}

@ApiTags('Blog Admin')
@ApiBearerAuth()
@Controller('admin/blog')
export class BlogAdminController {
  constructor(private readonly blogService: BlogService) {}

  @Get('posts')
  @ApiOperation({ summary: 'Admin list of posts' })
  @ApiOkResponse({ type: BlogPostListResponseDto })
  async listPosts(
    @Query() query: BlogAdminPostsQueryDto,
  ): Promise<BlogPostListResponseDto> {
    return this.blogService.adminListPosts(query);
  }

  @Post('posts')
  @ApiOperation({ summary: 'Create a blog post' })
  @ApiOkResponse({ type: BlogPostDto })
  async createPost(
    @Body() dto: CreateBlogPostDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<BlogPostDto> {
    const userId = requireAuthenticatedUser(user);
    return this.blogService.createPost(dto, userId);
  }

  @Patch('posts/:id')
  @ApiOperation({ summary: 'Update a blog post' })
  @ApiOkResponse({ type: BlogPostDto })
  async updatePost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBlogPostDto,
  ): Promise<BlogPostDto> {
    return this.blogService.updatePost(id, dto);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a blog post' })
  @ApiNoContentResponse()
  async deletePost(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.blogService.softDeletePost(id);
  }

  @Post('posts/:id/pin')
  @ApiOperation({ summary: 'Pin or unpin a blog post' })
  @ApiOkResponse({ type: BlogPostDto })
  async updatePinStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBlogPinStatusDto,
  ): Promise<BlogPostDto> {
    return this.blogService.updatePostPinStatus(id, dto);
  }

  @Get('comments')
  @ApiOperation({ summary: 'Admin list of comments' })
  @ApiOkResponse({ type: BlogCommentListResponseDto })
  async listComments(
    @Query() query: BlogAdminCommentsQueryDto,
  ): Promise<BlogCommentListResponseDto> {
    return this.blogService.adminListComments(query);
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Update comment status' })
  @ApiOkResponse({ type: BlogCommentDto })
  async updateCommentStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBlogCommentStatusDto,
  ): Promise<BlogCommentDto> {
    return this.blogService.updateCommentStatus(id, dto);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a blog category' })
  @ApiOkResponse({ type: BlogCategoryDto })
  async createCategory(
    @Body() dto: CreateBlogCategoryDto,
  ): Promise<BlogCategoryDto> {
    return this.blogService.createCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a blog category' })
  @ApiOkResponse({ type: BlogCategoryDto })
  async updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBlogCategoryDto,
  ): Promise<BlogCategoryDto> {
    return this.blogService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Disable a blog category' })
  @ApiNoContentResponse()
  async deleteCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.blogService.deleteCategory(id);
  }
}
