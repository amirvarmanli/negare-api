import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class TopicQueryDto {
  @ApiPropertyOptional({ example: 'dashboard' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  q?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
