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
  @Matches(/^[\p{L}\p{N}\s_-]+$/u, {
    message: 'Tag name can only contain letters, numbers, spaces, _ or -',
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

