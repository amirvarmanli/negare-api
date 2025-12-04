import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateBlogPinStatusDto {
  @ApiProperty({ description: 'Whether this post should be pinned' })
  @IsBoolean()
  isPinned!: boolean;
}
