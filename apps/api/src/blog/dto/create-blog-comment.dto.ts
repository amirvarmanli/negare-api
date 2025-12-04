import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateBlogCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @Length(1, 2000)
  content!: string;

  @ApiPropertyOptional({ description: 'Optional parent comment id (UUID)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
