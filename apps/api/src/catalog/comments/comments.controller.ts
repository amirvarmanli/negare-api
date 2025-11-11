import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { RoleName } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { Public } from '@app/common/decorators/public.decorator';
import { Roles } from '@app/common/decorators/roles.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { CommentsService } from '@app/catalog/comments/comments.service';
import { CreateCommentDto } from '@app/catalog/comments/dtos/comment-create.dto';
import { UpdateCommentDto } from '@app/catalog/comments/dtos/comment-update.dto';
import { CommentQueryDto } from '@app/catalog/comments/dtos/comment-query.dto';
import {
  CommentDto,
  CommentListDto,
  ProductCommentsResultDto,
} from '@app/catalog/comments/dtos/comment-response.dto';
import { ProductCommentQueryDto } from '@app/catalog/comments/dtos/product-comment-query.dto';

@ApiTags('Catalog / Comments')
@Controller('catalog/comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a comment' })
  @ApiOkResponse({ type: CommentDto })
  async create(
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<CommentDto> {
    const userId = requireUserId(user);
    return this.service.create(userId, dto);
  }

  @Get()
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'List comments for moderation' })
  @ApiOkResponse({ type: CommentListDto })
  async list(@Query() query: CommentQueryDto): Promise<CommentListDto> {
    return this.service.listModeration(query);
  }

  @Get('product/:productId')
  @Public()
  @ApiOperation({ summary: 'List approved comments for a product' })
  @ApiOkResponse({ type: ProductCommentsResultDto })
  async listForProduct(
    @Param('productId') productId: string,
    @Query() query: ProductCommentQueryDto,
  ): Promise<ProductCommentsResultDto> {
    return this.service.listForProduct(productId, query);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Update or moderate a comment' })
  @ApiOkResponse({ type: CommentDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Delete a comment and its replies' })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
