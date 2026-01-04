import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CategoryReorderDto {
  @ApiPropertyOptional({
    description: 'Parent category id (BigInt as string); omit or null for roots',
    nullable: true,
    example: '12',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/u)
  parentId?: string | null;

  @ApiProperty({
    description: 'Ordered list of sibling category ids (BigInt as string)',
    type: [String],
    example: ['12', '14', '9'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^\d+$/u, { each: true })
  orderedIds!: string[];
}
