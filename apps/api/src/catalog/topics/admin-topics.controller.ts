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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { TopicsService } from '@app/catalog/topics/topics.service';
import { CreateTopicDto } from '@app/catalog/topics/dtos/topic-create.dto';
import { UpdateTopicDto } from '@app/catalog/topics/dtos/topic-update.dto';
import { TopicQueryDto } from '@app/catalog/topics/dtos/topic-query.dto';
import { TopicDto, TopicListDto } from '@app/catalog/topics/dtos/topic-response.dto';

@ApiTags('Admin - Topics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('admin.categories:manage')
@Controller('admin/topics')
export class AdminTopicsController {
  constructor(private readonly service: TopicsService) {}

  @Get()
  @ApiOperation({ summary: 'List topics (admin)' })
  @ApiOkResponse({ type: TopicListDto })
  async findAll(@Query() query: TopicQueryDto): Promise<TopicListDto> {
    return this.service.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a topic (admin)' })
  @ApiCreatedResponse({ type: TopicDto })
  async create(@Body() dto: CreateTopicDto): Promise<TopicDto> {
    return this.service.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get topic by id (admin)' })
  @ApiOkResponse({ type: TopicDto })
  @ApiParam({ name: 'id', description: 'Topic id (BigInt as string)' })
  async findById(@Param('id') id: string): Promise<TopicDto> {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a topic (admin)' })
  @ApiOkResponse({ type: TopicDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTopicDto,
  ): Promise<TopicDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a topic (admin)' })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
