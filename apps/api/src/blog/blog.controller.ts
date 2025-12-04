import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BlogService } from '@app/blog/blog.service';
import {
  BlogPostDto,
  BlogPostListResponseDto,
} from '@app/blog/dto/blog-post.dto';
import { BlogPostsQueryDto } from '@app/blog/dto/blog-posts-query.dto';
import { BlogCategoryListResponseDto } from '@app/blog/dto/blog-category.dto';
import { BlogCommentListResponseDto } from '@app/blog/dto/blog-comment.dto';
import { BlogCommentsQueryDto } from '@app/blog/dto/blog-comments-query.dto';
import { CreateBlogCommentDto } from '@app/blog/dto/create-blog-comment.dto';
import { BlogCommentDto } from '@app/blog/dto/blog-comment.dto';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { Public } from '@app/common/decorators/public.decorator';
function requireAuthenticatedUser(
  user: CurrentUserPayload | undefined,
): string {
  if (!user) {
    throw new ForbiddenException('Authentication required');
  }
  return user.id;
}

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get('posts')
  @Public()
  @ApiOperation({ summary: 'List blog posts' })
  @ApiOkResponse({ type: BlogPostListResponseDto })
  async listPosts(
    @Query() query: BlogPostsQueryDto,
  ): Promise<BlogPostListResponseDto> {
    return this.blogService.listPublicPosts(query);
  }

  @Get('posts/by-category/:slug')
  @Public()
  @ApiOperation({ summary: 'List posts for a specific category' })
  @ApiOkResponse({ type: BlogPostListResponseDto })
  async listPostsByCategory(
    @Param('slug') slug: string,
    @Query() query: BlogPostsQueryDto,
  ): Promise<BlogPostListResponseDto> {
    return this.blogService.listPostsByCategorySlug(slug, query);
  }

  @Get('posts/:slug/comments')
  @Public()
  @ApiOperation({ summary: 'List approved comments for a post' })
  @ApiOkResponse({ type: BlogCommentListResponseDto })
  async listPostComments(
    @Param('slug') slug: string,
    @Query() query: BlogCommentsQueryDto,
  ): Promise<BlogCommentListResponseDto> {
    return this.blogService.listPostComments(slug, query);
  }

  @Get('posts/:slug')
  @Public()
  @ApiOperation({ summary: 'Get post by slug' })
  @ApiOkResponse({ type: BlogPostDto })
  async getPost(@Param('slug') slug: string): Promise<BlogPostDto> {
    return this.blogService.getPostBySlug(slug);
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'List active blog categories' })
  @ApiOkResponse({ type: BlogCategoryListResponseDto })
  async listCategories(): Promise<BlogCategoryListResponseDto> {
    return this.blogService.listCategories();
  }

  @Get('categories/all')
  @Public()
  @ApiOperation({ summary: 'List all blog categories' })
  @ApiOkResponse({ type: BlogCategoryListResponseDto })
  async listAllCategories(): Promise<BlogCategoryListResponseDto> {
    return this.blogService.listAllCategories();
  }

  @Post('posts/:id/comments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a comment on a post' })
  @ApiOkResponse({ type: BlogCommentDto })
  async createComment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateBlogCommentDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<BlogCommentDto> {
    const userId = requireAuthenticatedUser(user);
    return this.blogService.createComment(id, dto, userId);
  }
}
