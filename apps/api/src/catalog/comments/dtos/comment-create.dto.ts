import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { CommentTarget } from '@prisma/client';
import { toBigIntString, toTrimmedString } from '@app/catalog/product/dtos/transformers';

export class CreateCommentDto {
  @ApiProperty({ enum: CommentTarget })
  @IsEnum(CommentTarget)
  targetType!: CommentTarget;

  @ApiProperty({ example: 'product-123' })
  @IsString()
  @Length(1, 64)
  @Transform(toTrimmedString)
  targetId!: string;

  @ApiProperty({
    description: 'Optional link to product (BigInt as string)',
    example: '42',
  })
  @IsOptional()
  @Transform(toBigIntString)
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Parent comment id (BigInt as string)',
    example: '10',
  })
  @IsOptional()
  @Transform(toBigIntString)
  @IsString()
  parentId?: string;

  @ApiProperty({
    example: 'این محصول فوق‌العاده بود!',
  })
  @IsString()
  @Length(2, 5000)
  body!: string;
}
