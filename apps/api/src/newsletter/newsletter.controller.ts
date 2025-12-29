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
import { NewsletterService } from '@app/newsletter/newsletter.service';
import {
  NewsletterIssueDto,
  NewsletterIssueListResponseDto,
} from '@app/newsletter/dto/newsletter-issue.dto';
import { NewsletterIssuesQueryDto } from '@app/newsletter/dto/newsletter-issues-query.dto';
import {
  NewsletterCategoryListResponseDto,
} from '@app/newsletter/dto/newsletter-category.dto';
import {
  NewsletterCommentListResponseDto,
  NewsletterCommentDto,
} from '@app/newsletter/dto/newsletter-comment.dto';
import { NewsletterCommentsQueryDto } from '@app/newsletter/dto/newsletter-comments-query.dto';
import { CreateNewsletterCommentDto } from '@app/newsletter/dto/create-newsletter-comment.dto';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { Public } from '@app/common/decorators/public.decorator';

function requireAuthenticatedUser(
  user: CurrentUserPayload | undefined,
): CurrentUserPayload {
  if (!user) {
    throw new ForbiddenException('Authentication required');
  }
  return user;
}

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get('issues')
  @Public()
  @ApiOperation({ summary: 'List published newsletter issues' })
  @ApiOkResponse({ type: NewsletterIssueListResponseDto })
  async listIssues(
    @Query() query: NewsletterIssuesQueryDto,
  ): Promise<NewsletterIssueListResponseDto> {
    return this.newsletterService.listPublicIssues(query);
  }

  @Get('issues/by-category/:slug')
  @Public()
  @ApiOperation({ summary: 'List issues for a category' })
  @ApiOkResponse({ type: NewsletterIssueListResponseDto })
  async listIssuesByCategory(
    @Param('slug') slug: string,
    @Query() query: NewsletterIssuesQueryDto,
  ): Promise<NewsletterIssueListResponseDto> {
    return this.newsletterService.listIssuesByCategorySlug(slug, query);
  }

  @Get('issues/:slug/comments')
  @Public()
  @ApiOperation({ summary: 'List approved issue comments' })
  @ApiOkResponse({ type: NewsletterCommentListResponseDto })
  async listIssueComments(
    @Param('slug') slug: string,
    @Query() query: NewsletterCommentsQueryDto,
  ): Promise<NewsletterCommentListResponseDto> {
    return this.newsletterService.listIssueComments(slug, query);
  }

  @Get('issues/:slug')
  @Public()
  @ApiOperation({ summary: 'Fetch issue by slug' })
  @ApiOkResponse({ type: NewsletterIssueDto })
  async getIssue(@Param('slug') slug: string): Promise<NewsletterIssueDto> {
    return this.newsletterService.getIssueBySlug(slug);
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'List newsletter categories' })
  @ApiOkResponse({ type: NewsletterCategoryListResponseDto })
  async listCategories(): Promise<NewsletterCategoryListResponseDto> {
    return this.newsletterService.listCategories();
  }

  @Get('categories/all')
  @Public()
  @ApiOperation({ summary: 'List all newsletter categories' })
  @ApiOkResponse({ type: NewsletterCategoryListResponseDto })
  async listAllCategories(): Promise<NewsletterCategoryListResponseDto> {
    return this.newsletterService.listAllCategories();
  }

  @Post('issues/:id/comments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a comment on an issue' })
  @ApiOkResponse({ type: NewsletterCommentDto })
  async createComment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateNewsletterCommentDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NewsletterCommentDto> {
    const currentUser = requireAuthenticatedUser(user);
    return this.newsletterService.createComment(id, dto, currentUser.id);
  }
}
