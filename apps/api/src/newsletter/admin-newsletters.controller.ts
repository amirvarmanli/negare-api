import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '@app/common/decorators/current-user.decorator';
import { Roles } from '@app/common/decorators/roles.decorator';
import { NewsletterService } from '@app/newsletter/newsletter.service';
import { AdminNewslettersListQueryDto } from '@app/newsletter/dto/admin-newsletters-list-query.dto';
import { NewsletterAdminListResponseDto } from '@app/newsletter/dto/admin-newsletters-list-item.dto';
import { NewsletterAdminDetailDto } from '@app/newsletter/dto/admin-newsletter-detail.dto';
import { AdminUpdateNewsletterDto } from '@app/newsletter/dto/admin-update-newsletter.dto';
import { AdminRejectDto } from '@app/newsletter/dto/admin-reject.dto';

@ApiTags('Admin Newsletters')
@ApiBearerAuth()
@Controller('admin/newsletters')
@UseGuards(JwtAuthGuard)
@Roles(RoleName.admin)
export class AdminNewslettersController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get()
  @ApiOperation({ summary: 'List all newsletters with filters and pagination' })
  @ApiOkResponse({ type: NewsletterAdminListResponseDto })
  async list(
    @Query() query: AdminNewslettersListQueryDto,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<NewsletterAdminListResponseDto> {
    return this.newsletterService.adminListAllIssues(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a newsletter issue by ID' })
  @ApiOkResponse({ type: NewsletterAdminDetailDto })
  async getById(
    @Param('id') id: string,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<NewsletterAdminDetailDto> {
    return this.newsletterService.adminGetIssue(id, currentUser);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a newsletter issue (admin)' })
  @ApiOkResponse({ type: NewsletterAdminDetailDto })
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateNewsletterDto,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<NewsletterAdminDetailDto> {
    return this.newsletterService.adminUpdateIssue(id, dto, currentUser);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a newsletter issue' })
  @ApiOkResponse({ type: NewsletterAdminDetailDto })
  async approve(
    @Param('id') id: string,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<NewsletterAdminDetailDto> {
    return this.newsletterService.adminApproveIssue(id, currentUser);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a newsletter issue' })
  @ApiOkResponse({ type: NewsletterAdminDetailDto })
  async reject(
    @Param('id') id: string,
    @Body() dto: AdminRejectDto,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<NewsletterAdminDetailDto> {
    return this.newsletterService.adminRejectIssue(id, dto, currentUser);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a newsletter issue' })
  @ApiOkResponse({ type: NewsletterAdminDetailDto })
  async archive(
    @Param('id') id: string,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<NewsletterAdminDetailDto> {
    return this.newsletterService.adminArchiveIssue(id, currentUser);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Unarchive a newsletter issue' })
  @ApiOkResponse({ type: NewsletterAdminDetailDto })
  async unarchive(
    @Param('id') id: string,
    @CurrentUser() currentUser?: CurrentUserPayload,
  ): Promise<NewsletterAdminDetailDto> {
    return this.newsletterService.adminUnarchiveIssue(id, currentUser);
  }
}
