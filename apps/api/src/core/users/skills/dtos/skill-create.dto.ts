// apps/api/src/core/users/skills/dtos/skill-create.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SkillCreateDto {
  @ApiProperty({
    description:
      'عنوان فارسی مهارت که در پنل و صفحه هنرمندان نمایش داده می‌شود.',
    example: 'گرافیست',
  })
  @IsString()
  @IsNotEmpty()
  nameFa: string; // مثال: گرافیست
}
