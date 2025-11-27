import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('Catalog / Artists')
@Controller('catalog/artists')
export class ArtistController {
  constructor(private readonly service: ArtistService) {}

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

  @Post(':id/follow')
  @ApiBearerAuth()
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow an artist' })
  @ApiOkResponse({ type: ArtistFollowResponseDto })
  async unfollow(
    @Param() params: ArtistIdParamDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<ArtistFollowResponseDto> {
    const userId = requireUserId(user);
    return this.service.unfollow(params.id, userId);
  }
}
