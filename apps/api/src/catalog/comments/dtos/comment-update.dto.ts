import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { toTrimmedString } from '@app/catalog/product/dtos/transformers';

export class UpdateCommentDto {
  @ApiPropertyOptional({
    description: 'Updated body',
    example: 'متن جدید برای نظر',
  })
  @IsOptional()
  @IsString()
  @Length(2, 5000)
  @Transform(toTrimmedString)
  body?: string;

  @ApiPropertyOptional({ description: 'Approve or reject comment' })
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;
}
