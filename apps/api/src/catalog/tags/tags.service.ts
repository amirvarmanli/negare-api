import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from '../entities/content/tag.entity';
import { CreateTagDto } from './dtos/create-tag.dto';
import { UpdateTagDto } from './dtos/update-tag.dto';
import { buildUniqueSlugCandidate, slugify } from '../utils/slug.util';

@Injectable()
export class TagsService {
  private readonly slugMaxAttempts = 10;

  constructor(
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
  ) {}

  async findAll(): Promise<Tag[]> {
    return this.tagsRepository.find({ order: { name: 'ASC' } });
  }

  async create(dto: CreateTagDto): Promise<Tag> {
    const slug = await this.resolveUniqueSlug(dto.slug ?? slugify(dto.name));

    const entity = this.tagsRepository.create({
      name: dto.name,
      slug,
    });

    return this.tagsRepository.save(entity);
  }

  async update(id: string, dto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findTagOrThrow(id);

    if (dto.name !== undefined) {
      tag.name = dto.name;
    }

    if (dto.slug !== undefined) {
      tag.slug = await this.resolveUniqueSlug(dto.slug, id);
    } else if (dto.name) {
      tag.slug = await this.resolveUniqueSlug(slugify(dto.name), id);
    }

    return this.tagsRepository.save(tag);
  }

  async remove(id: string): Promise<void> {
    const result = await this.tagsRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Tag not found');
    }
  }

  private async findTagOrThrow(id: string): Promise<Tag> {
    const tag = await this.tagsRepository.findOne({ where: { id } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return tag;
  }

  private async resolveUniqueSlug(base: string, ignoreId?: string): Promise<string> {
    if (!base) {
      throw new BadRequestException('Slug could not be generated');
    }

    for (let attempt = 0; attempt < this.slugMaxAttempts; attempt += 1) {
      const candidate = buildUniqueSlugCandidate(base, attempt);
      const existing = await this.tagsRepository.findOne({
        where: { slug: candidate },
      });

      if (!existing || (ignoreId && existing.id === ignoreId)) {
        return candidate;
      }
    }

    throw new BadRequestException('Unable to generate unique tag slug');
  }
}
