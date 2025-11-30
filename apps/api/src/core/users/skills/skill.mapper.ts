import { Skill } from '@prisma/client';
import { SkillDto } from './dtos/skill-response.dto';

export class SkillMapper {
  /**
   * تبدیل موجودیت Prisma Skill به SkillDto
   */
  static toDto(entity: Skill): SkillDto {
    if (!entity) return null;

    return {
      id: entity.id,
      key: entity.key,
      nameFa: entity.nameFa,
      nameEn: entity.nameEn ?? null,
      description: entity.description ?? null,
      isActive: entity.isActive,
      sortOrder: entity.sortOrder,
    };
  }

  /**
   * تبدیل آرایه‌ای از Skill → SkillDto[]
   */
  static toDtoList(entities: Skill[]): SkillDto[] {
    if (!entities?.length) return [];
    return entities.map((e) => SkillMapper.toDto(e));
  }
}
