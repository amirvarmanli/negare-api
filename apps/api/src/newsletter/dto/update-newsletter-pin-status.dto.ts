import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateNewsletterPinStatusDto {
  @ApiProperty({ description: 'Whether this newsletter issue is pinned' })
  @IsBoolean()
  isPinned!: boolean;
}
