import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateBlogPostDto } from '@app/blog/dto/create-blog-post.dto';

export class UpdateBlogPostDto extends PartialType(CreateBlogPostDto) {
  @ApiPropertyOptional({ description: 'Assign to a different author (UUID)' })
  @IsOptional()
  @IsUUID()
  authorId?: string;
}
