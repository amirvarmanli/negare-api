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
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { Public } from '@app/common/decorators/public.decorator';
import { Roles } from '@app/common/decorators/roles.decorator';
import {
  normalizeFaText,
  safeDecodeSlug,
} from '@shared-slug/slug/fa-slug.util';
import { TopicsService } from '@app/catalog/topics/topics.service';
import { CreateTopicDto } from '@app/catalog/topics/dtos/topic-create.dto';
import { UpdateTopicDto } from '@app/catalog/topics/dtos/topic-update.dto';
import { TopicQueryDto } from '@app/catalog/topics/dtos/topic-query.dto';
import {
  TopicDto,
  TopicListDto,
} from '@app/catalog/topics/dtos/topic-response.dto';

@ApiTags('Catalog / Topics')
@Controller('catalog/topics')
export class TopicsController {
  constructor(private readonly service: TopicsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Create a topic' })
  @ApiCreatedResponse({ type: TopicDto })
  async create(@Body() dto: CreateTopicDto): Promise<TopicDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Update a topic' })
  @ApiOkResponse({ type: TopicDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTopicDto,
  ): Promise<TopicDto> {
    return this.service.update(id, dto);
  }

  @Get('id/:id')
  @Public()
  @ApiOperation({ summary: 'Get topic by numeric id' })
  @ApiOkResponse({ type: TopicDto })
  @ApiParam({ name: 'id', example: '12', description: 'Topic id' })
  async findById(@Param('id') id: string): Promise<TopicDto> {
    return this.service.findById(id);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get topic by slug (Persian-safe)',
    description:
      'Handles URL-decoding/normalization and emits a 301 redirect when the slug has changed.',
  })
  @ApiOkResponse({ type: TopicDto })
  @ApiResponse({
    status: 301,
    description: 'Redirect to the canonical slug',
  })
  @ApiParam({
    name: 'slug',
    example: 'نقاشی-و-تصویرسازی',
    description: 'Topic slug',
  })
  async findBySlug(
    @Param('slug') slugParam: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TopicDto | undefined> {
    const normalized = normalizeFaText(safeDecodeSlug(slugParam));
    const result = await this.service.findBySlug(normalized);
    if (result.redirectTo) {
      res.redirect(
        HttpStatus.MOVED_PERMANENTLY,
        `/catalog/topics/${encodeURIComponent(result.redirectTo)}`,
      );
      return undefined;
    }
    return result.topic;
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List topics' })
  @ApiOkResponse({ type: TopicListDto })
  async findAll(@Query() query: TopicQueryDto): Promise<TopicListDto> {
    return this.service.findAll(query);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Delete a topic' })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
