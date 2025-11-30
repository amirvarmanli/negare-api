// apps/api/src/core/users/skills/dtos/user-skills-set.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UserSkillsSetDto {
  @ApiProperty({
    description: 'لیست keyهای مهارت که باید برای کاربر تنظیم شود.',
    example: ['GRAPHIC_DESIGNER', 'ILLUSTRATOR'],
    isArray: true,
    type: String,
  })
  @IsArray()
  @IsString({ each: true })
  skillKeys: string[];
}
