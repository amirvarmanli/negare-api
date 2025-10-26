import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Display name of the category',
    example: 'User Interface Kits',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Optional slug, generated automatically when omitted',
    required: false,
    example: 'user-interface-kits',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiProperty({
    description: 'Optional parent category identifier to build hierarchy',
    required: false,
    example: 12,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return value === '' ? undefined : value;
    }
    return String(value);
  })
  @IsString()
  parentId?: string | null;
}



