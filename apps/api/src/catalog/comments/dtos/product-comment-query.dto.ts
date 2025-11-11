import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ProductCommentQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor (base64)' })
  @IsOptional()
  cursor?: string;
}
