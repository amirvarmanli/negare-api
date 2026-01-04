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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { NewsletterService } from '@app/newsletter/newsletter.service';
import {
  NewsletterIssueDto,
  NewsletterIssueListResponseDto,
} from '@app/newsletter/dto/newsletter-issue.dto';
import { NewsletterAdminIssuesQueryDto } from '@app/newsletter/dto/newsletter-issues-query.dto';
import { CreateNewsletterIssueDto } from '@app/newsletter/dto/create-newsletter-issue.dto';
import { UpdateNewsletterIssueDto } from '@app/newsletter/dto/update-newsletter-issue.dto';
import {
  NewsletterCommentDto,
  NewsletterCommentListResponseDto,
} from '@app/newsletter/dto/newsletter-comment.dto';
import { NewsletterAdminCommentsQueryDto } from '@app/newsletter/dto/newsletter-comments-query.dto';
import { UpdateNewsletterCommentStatusDto } from '@app/newsletter/dto/update-newsletter-comment-status.dto';
import { CreateNewsletterCategoryDto } from '@app/newsletter/dto/create-newsletter-category.dto';
import {
  NewsletterCategoryDto,
} from '@app/newsletter/dto/newsletter-category.dto';
import { UpdateNewsletterCategoryDto } from '@app/newsletter/dto/update-newsletter-category.dto';
import { UpdateNewsletterPinStatusDto } from '@app/newsletter/dto/update-newsletter-pin-status.dto';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';

function requireAuthenticatedUser(
  user: CurrentUserPayload | undefined,
): CurrentUserPayload {
  if (!user) {
    throw new ForbiddenException('Authentication required');
  }
  return user;
}

@ApiTags('Newsletter Admin')
@ApiBearerAuth()
@Controller('admin/newsletter')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('admin.newsletter:manage')
export class NewsletterAdminController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get('issues')
  @ApiOperation({ summary: 'Admin list of newsletter issues' })
  @ApiOkResponse({ type: NewsletterIssueListResponseDto })
  async listIssues(
    @Query() query: NewsletterAdminIssuesQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NewsletterIssueListResponseDto> {
    const currentUser = requireAuthenticatedUser(user);
    return this.newsletterService.adminListIssues(query, currentUser);
  }

  @Get('issues/:id')
  @ApiOperation({ summary: 'Get a newsletter issue by ID (supplier/admin panel)' })
  @ApiParam({ name: 'id', description: 'Newsletter issue UUID' })
  @ApiOkResponse({ type: NewsletterIssueDto })
  async getIssueById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NewsletterIssueDto> {
    const currentUser = requireAuthenticatedUser(user);
    return this.newsletterService.findAdminNewsletterIssueById(
      id,
      currentUser,
    );
  }

  @Get('issues/slug/:slug')
  @ApiOperation({
    summary: 'Get a newsletter issue by slug (legacy supplier/admin panel fallback)',
  })
  @ApiParam({
    name: 'slug',
    description: 'Legacy slug (Persian/Unicode supported)',
  })
  @ApiOkResponse({ type: NewsletterIssueDto })
  async getIssueBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NewsletterIssueDto> {
    const currentUser = requireAuthenticatedUser(user);
    return this.newsletterService.findAdminNewsletterIssueBySlug(
      slug,
      currentUser,
    );
  }

  @Post('issues')
  @ApiOperation({ summary: 'Create a newsletter issue' })
  @ApiOkResponse({ type: NewsletterIssueDto })
  async createIssue(
    @Body() dto: CreateNewsletterIssueDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NewsletterIssueDto> {
    const currentUser = requireAuthenticatedUser(user);
    return this.newsletterService.createIssue(dto, currentUser.id);
  }

  @Patch('issues/:id')
  @ApiOperation({ summary: 'Update a newsletter issue' })
  @ApiOkResponse({ type: NewsletterIssueDto })
  async updateIssue(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNewsletterIssueDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NewsletterIssueDto> {
    const currentUser = requireAuthenticatedUser(user);
    return this.newsletterService.updateIssue(id, dto, currentUser);
  }

  @Delete('issues/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an issue' })
  @ApiNoContentResponse()
  async deleteIssue(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<void> {
    const currentUser = requireAuthenticatedUser(user);
    await this.newsletterService.softDeleteIssue(id, currentUser);
  }

  @Post('issues/:id/pin')
  @ApiOperation({
    summary: 'Pin or unpin a newsletter issue',
    description:
      'Only one item can be pinned at a time; pinning a new item automatically unpins the previous one.',
  })
  @ApiOkResponse({ type: NewsletterIssueDto })
  async updatePinStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNewsletterPinStatusDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NewsletterIssueDto> {
    const currentUser = requireAuthenticatedUser(user);
    return this.newsletterService.updateIssuePinStatus(id, dto, currentUser);
  }

  @Get('comments')
  @ApiOperation({ summary: 'Admin list of newsletter comments' })
  @ApiOkResponse({ type: NewsletterCommentListResponseDto })
  async listComments(
    @Query() query: NewsletterAdminCommentsQueryDto,
  ): Promise<NewsletterCommentListResponseDto> {
    return this.newsletterService.adminListComments(query);
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Update newsletter comment status' })
  @ApiOkResponse({ type: NewsletterCommentDto })
  async updateCommentStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNewsletterCommentStatusDto,
  ): Promise<NewsletterCommentDto> {
    return this.newsletterService.updateCommentStatus(id, dto);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create newsletter category' })
  @ApiOkResponse({ type: NewsletterCategoryDto })
  async createCategory(
    @Body() dto: CreateNewsletterCategoryDto,
  ): Promise<NewsletterCategoryDto> {
    return this.newsletterService.createCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update newsletter category' })
  @ApiOkResponse({ type: NewsletterCategoryDto })
  async updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNewsletterCategoryDto,
  ): Promise<NewsletterCategoryDto> {
    return this.newsletterService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Disable newsletter category' })
  @ApiNoContentResponse()
  async deleteCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.newsletterService.deleteCategory(id);
  }
}
