import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CommentTarget } from '@prisma/client';
import { Transform } from 'class-transformer';
import { toBigIntString } from '@app/catalog/product/dtos/transformers';

export class CommentQueryDto {
  @ApiPropertyOptional({ enum: CommentTarget })
  @IsOptional()
  @IsEnum(CommentTarget)
  targetType?: CommentTarget;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Product id (BigInt as string)',
  })
  @IsOptional()
  @Transform(toBigIntString)
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by approval state' })
  @IsOptional()
  @IsBooleanString()
  isApproved?: string;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
