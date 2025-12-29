import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty({ example: '1024' })
  productId!: string;

  @ApiProperty({ example: 1 })
  qty!: number;

  @ApiProperty({ example: 250000 })
  unitPrice!: number;

  @ApiPropertyOptional({ example: 'Premium Pack' })
  title?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.png' })
  coverImage?: string;
}

export class CartResponseDto {
  @ApiProperty({ example: '6e9f1b9a-1b9d-4a5f-8f4b-9a0a1b2c3d4e' })
  cartId!: string;

  @ApiProperty({ type: [CartItemDto] })
  items!: CartItemDto[];

  @ApiProperty({ example: 200000 })
  totalAmount!: number;
}

export class CartCheckoutResponseDto {
  @ApiProperty({ example: 'b6c9a54d-0df7-4b7e-86d6-fd4c4f1a9b2a' })
  orderId!: string;

  @ApiProperty({ example: 200000 })
  total!: number;

  @ApiProperty({ example: 1 })
  itemsCount!: number;
}
