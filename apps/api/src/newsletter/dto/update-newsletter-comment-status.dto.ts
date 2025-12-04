import { ApiProperty } from '@nestjs/swagger';
import { CommentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateNewsletterCommentStatusDto {
  @ApiProperty({ enum: CommentStatus })
  @IsEnum(CommentStatus)
  status!: CommentStatus;
}
