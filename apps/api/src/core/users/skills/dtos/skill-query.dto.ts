// apps/api/src/core/users/skills/dtos/skill-query.dto.ts
import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SkillQueryDto {
  @ApiPropertyOptional({
    description:
      'جستجو روی نام فارسی، نام انگلیسی و key مهارت. جستجو به صورت contains و case-insensitive انجام می‌شود.',
    example: 'گرافیک',
    type: String,
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description:
      'فیلتر فعال/غیرفعال بودن مهارت. مقدار باید به صورت string و یکی از "true" یا "false" باشد.',
    example: 'true',
    type: String,
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
