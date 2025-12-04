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

function requireAuthenticatedUser(
  user: CurrentUserPayload | undefined,
): string {
  if (!user) {
    throw new ForbiddenException('Authentication required');
  }
  return user.id;
}

@ApiTags('Newsletter Admin')
@ApiBearerAuth()
@Controller('admin/newsletter')
export class NewsletterAdminController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get('issues')
  @ApiOperation({ summary: 'Admin list of newsletter issues' })
  @ApiOkResponse({ type: NewsletterIssueListResponseDto })
  async listIssues(
    @Query() query: NewsletterAdminIssuesQueryDto,
  ): Promise<NewsletterIssueListResponseDto> {
    return this.newsletterService.adminListIssues(query);
  }

  @Post('issues')
  @ApiOperation({ summary: 'Create a newsletter issue' })
  @ApiOkResponse({ type: NewsletterIssueDto })
  async createIssue(
    @Body() dto: CreateNewsletterIssueDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<NewsletterIssueDto> {
    const userId = requireAuthenticatedUser(user);
    return this.newsletterService.createIssue(dto, userId);
  }

  @Patch('issues/:id')
  @ApiOperation({ summary: 'Update a newsletter issue' })
  @ApiOkResponse({ type: NewsletterIssueDto })
  async updateIssue(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNewsletterIssueDto,
  ): Promise<NewsletterIssueDto> {
    return this.newsletterService.updateIssue(id, dto);
  }

  @Delete('issues/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an issue' })
  @ApiNoContentResponse()
  async deleteIssue(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.newsletterService.softDeleteIssue(id);
  }

  @Post('issues/:id/pin')
  @ApiOperation({ summary: 'Pin or unpin a newsletter issue' })
  @ApiOkResponse({ type: NewsletterIssueDto })
  async updatePinStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNewsletterPinStatusDto,
  ): Promise<NewsletterIssueDto> {
    return this.newsletterService.updateIssuePinStatus(id, dto);
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
