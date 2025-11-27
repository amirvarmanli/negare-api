import { ApiProperty } from '@nestjs/swagger';

export class BookmarkToggleResponseDto {
  @ApiProperty({ example: '123' })
  productId!: string;

  @ApiProperty({ example: true })
  bookmarked!: boolean;
}
