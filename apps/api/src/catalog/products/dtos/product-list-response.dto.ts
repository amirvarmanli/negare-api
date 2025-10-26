
import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../../entities/content/product.entity';

export class ProductListResponseDto {
  @ApiProperty({
    type: [Product],
    description: 'Collection of products for the current page.',
  })
  data: Product[];

  @ApiProperty({
    description: 'Total number of products matching the applied filters.',
  })
  total: number;

  @ApiProperty({ description: 'Current page number.' })
  page: number;

  @ApiProperty({ description: 'Maximum number of items per page.' })
  limit: number;

  @ApiProperty({
    description: 'Indicates whether more pages are available after this one.',
  })
  hasNext: boolean;
}
