import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../../entities/content/product.entity';

export class ProductDetailResponseDto extends Product {
  @ApiProperty({
    description:
      'Indicates whether the authenticated user likes this product. Always false when unauthenticated.',
    example: true,
  })
  liked: boolean;

  @ApiProperty({
    description:
      'Indicates whether the authenticated user bookmarked this product. Always false when unauthenticated.',
    example: false,
  })
  bookmarked: boolean;
}
