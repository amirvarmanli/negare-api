// apps/api/src/catalog/artist/artist.controller.ts

import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { Public } from '@app/common/decorators/public.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { ArtistService } from '@app/catalog/artist/artist.service';
import { ArtistIdParamDto } from '@app/catalog/artist/dtos/artist-id.dto';
import { ArtistProfileDto } from '@app/catalog/artist/dtos/artist-profile.dto';
import { ArtistProductsQueryDto } from '@app/catalog/artist/dtos/artist-products-query.dto';
import { ProductListResultDto } from '@app/catalog/product/dtos/product-response.dto';
import { ArtistFollowResponseDto } from '@app/catalog/artist/dtos/artist-follow.dto';
import { FollowedArtistsListDto } from '@app/catalog/artist/dtos/artist-following.dto';
import {
  ArtistListQueryDto,
  ArtistListResultDto,
} from '@app/catalog/artist/dtos/artist-list.dto';

// ───────────────────────────────────────────────────────────────
// DTO برای pagination لیست هنرمندانی که فالو شده‌اند
// ───────────────────────────────────────────────────────────────
export class FollowingsQueryDto {
  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 60, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number;
}

@ApiTags('Catalog / Artists')
@ApiBearerAuth()
@Controller('catalog/artists')
export class ArtistController {
  constructor(private readonly service: ArtistService) {}

  // ───────────────────────────────────────────────────────────────
  // آرشیو هنرمندان (لیست عمومی)
  // ───────────────────────────────────────────────────────────────
  @Get()
  @Public()
  @ApiOperation({
    summary: 'List artists (archive)',
    description:
      'آرشیو هنرمندان با امکان جستجو، فیلتر بر اساس مهارت و مرتب‌سازی.',
  })
  @ApiOkResponse({ type: ArtistListResultDto })
  async listArtists(
    @Query() query: ArtistListQueryDto,
  ): Promise<ArtistListResultDto> {
    return this.service.listArtists(query);
  }

  // ───────────────────────────────────────────────────────────────
  // لیست هنرمندانی که کاربر فعلی فالو کرده است
  // ───────────────────────────────────────────────────────────────
  @Get('following/me')
  @ApiOperation({ summary: 'List artists followed by current user' })
  @ApiOkResponse({ type: FollowedArtistsListDto })
  async listMyFollowedArtists(
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Query() query: FollowingsQueryDto,
  ): Promise<FollowedArtistsListDto> {
    const userId = requireUserId(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.service.listMyFollowedArtists(userId, page, limit);
  }

  // ───────────────────────────────────────────────────────────────
  // پروفایل هنرمند
  // ───────────────────────────────────────────────────────────────
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get artist profile with stats and top products' })
  @ApiOkResponse({ type: ArtistProfileDto })
  async getProfile(
    @Param() params: ArtistIdParamDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ArtistProfileDto> {
    return this.service.getProfile(params.id, user?.id);
  }

  // ───────────────────────────────────────────────────────────────
  // محصولات هنرمند
  // ───────────────────────────────────────────────────────────────
  @Get(':id/products')
  @Public()
  @ApiOperation({ summary: 'List products created by the artist' })
  @ApiOkResponse({ type: ProductListResultDto })
  async listProducts(
    @Param() params: ArtistIdParamDto,
    @Query() query: ArtistProductsQueryDto,
  ): Promise<ProductListResultDto> {
    return this.service.listProducts(params.id, query);
  }

  // ───────────────────────────────────────────────────────────────
  // Follow / Unfollow
  // ───────────────────────────────────────────────────────────────
  @Post(':id/follow')
  @ApiOperation({ summary: 'Follow an artist' })
  @ApiOkResponse({ type: ArtistFollowResponseDto })
  @ApiBadRequestResponse({ description: 'Cannot follow yourself' })
  async follow(
    @Param() params: ArtistIdParamDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ArtistFollowResponseDto> {
    const userId = requireUserId(user);
    return this.service.follow(params.id, userId);
  }

  @Delete(':id/follow')
  @ApiOperation({ summary: 'Unfollow an artist' })
  @ApiOkResponse({ type: ArtistFollowResponseDto })
  @ApiBadRequestResponse({ description: 'Cannot follow yourself' })
  async unfollow(
    @Param() params: ArtistIdParamDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ArtistFollowResponseDto> {
    const userId = requireUserId(user);
    return this.service.unfollow(params.id, userId);
  }
}
