import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Roles } from '@app/common/decorators/roles.decorator';
import { TagsService } from '@app/catalog/tags/tags.service';
import { CreateTagDto } from '@app/catalog/tags/dtos/tag-create.dto';
import { UpdateTagDto } from '@app/catalog/tags/dtos/tag-update.dto';
import { TagFindQueryDto } from '@app/catalog/tags/dtos/tag-query.dto';
import { TagDto, TagListResultDto } from '@app/catalog/tags/dtos/tag-response.dto';

@ApiTags('Catalog / Tags')
@Controller('catalog/tags')
export class TagsController {
  constructor(private readonly service: TagsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Create a tag' })
  @ApiCreatedResponse({ type: TagDto })
  async create(@Body() dto: CreateTagDto): Promise<TagDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Update a tag' })
  @ApiOkResponse({ type: TagDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<TagDto> {
    return this.service.update(id, dto);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Find a tag by id or slug' })
  @ApiOkResponse({ type: TagDto })
  async findOne(@Param('idOrSlug') idOrSlug: string): Promise<TagDto> {
    return this.service.findOne(idOrSlug);
  }

  @Get()
  @ApiOperation({ summary: 'List tags (flat)' })
  @ApiOkResponse({ type: TagListResultDto })
  async findAll(@Query() q: TagFindQueryDto): Promise<TagListResultDto> {
    return this.service.findAll(q);
  }

  @Get('/popular/top')
  @ApiOperation({ summary: 'Top tags by usage count' })
  @ApiOkResponse({ type: TagListResultDto })
  async popular(@Query('limit') limit = '20'): Promise<TagListResultDto> {
    return this.service.popular(Number(limit));
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Delete a tag (removes product links first)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
