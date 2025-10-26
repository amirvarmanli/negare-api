import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/content/category.entity';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { buildUniqueSlugCandidate, slugify } from '../utils/slug.util';

@Injectable()
export class CategoriesService {
  private readonly slugMaxAttempts = 10;

  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({
      relations: ['children', 'parent'],
      order: { name: 'ASC' },
    });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = await this.resolveUniqueSlug(dto.slug ?? slugify(dto.name));
    const parent = dto.parentId
      ? await this.findCategoryOrThrow(String(dto.parentId))
      : undefined;

    const entity = this.categoriesRepository.create({
      name: dto.name,
      slug,
      parent,
    });

    return this.categoriesRepository.save(entity);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findCategoryOrThrow(id);

    if (dto.name !== undefined) {
      category.name = dto.name;
    }

    if (dto.slug !== undefined) {
      category.slug = await this.resolveUniqueSlug(dto.slug, id);
    } else if (dto.name) {
      category.slug = await this.resolveUniqueSlug(slugify(dto.name), id);
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === null || dto.parentId === '') {
        category.parent = undefined;
      } else {
        const parentId = String(dto.parentId);
        if (parentId === id) {
          throw new BadRequestException('Category cannot be its own parent');
        }
        category.parent = await this.findCategoryOrThrow(parentId);
      }
    }

    return this.categoriesRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const result = await this.categoriesRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Category not found');
    }
  }

  private async findCategoryOrThrow(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async resolveUniqueSlug(base: string, ignoreId?: string): Promise<string> {
    if (!base) {
      throw new BadRequestException('Slug could not be generated');
    }

    for (let attempt = 0; attempt < this.slugMaxAttempts; attempt += 1) {
      const candidate = buildUniqueSlugCandidate(base, attempt);
      const existing = await this.categoriesRepository.findOne({
        where: { slug: candidate },
      });

      if (!existing || (ignoreId && existing.id === ignoreId)) {
        return candidate;
      }
    }

    throw new BadRequestException('Unable to generate unique category slug');
  }
}

