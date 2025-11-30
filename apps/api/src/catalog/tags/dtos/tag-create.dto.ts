import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTagDto {
  @ApiProperty({
    description: 'Display name of the tag',
    example: 'dashboard',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[^#,،\n]+$/u, {
    message: 'تگ نباید شامل # یا ویرگول باشد.',
  })
  name!: string;

  @ApiProperty({
    description: 'Optional slug, generated automatically if omitted',
    required: false,
    example: 'dashboard',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  slug?: string;
}
