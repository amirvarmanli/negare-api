import { ApiProperty } from '@nestjs/swagger';

export class ToggleLikeResponseDto {
  @ApiProperty({
    description: 'Indicates whether the product is liked after the operation.',
    example: true,
  })
  liked: boolean;

  @ApiProperty({
    description: 'Total number of likes for the product after the operation.',
    example: 42,
  })
  likesCount: number;
}
