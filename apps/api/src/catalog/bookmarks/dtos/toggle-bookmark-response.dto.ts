import { ApiProperty } from '@nestjs/swagger';

export class ToggleBookmarkResponseDto {
  @ApiProperty({
    description:
      'Indicates whether the product is bookmarked after the operation.',
    example: true,
  })
  bookmarked: boolean;
}
