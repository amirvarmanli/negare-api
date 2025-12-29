import { ApiProperty } from '@nestjs/swagger';
import { DiscountType, OrderKind, OrderStatus, ProductPricingType } from '@app/finance/common/finance.enums';

export class OrderItemResponseDto {
  @ApiProperty({ example: 'item-uuid' })
  id!: string;

  @ApiProperty({ example: '1024' })
  productId!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 250000 })
  unitPriceSnapshot!: number;

  @ApiProperty({ example: 250000 })
  lineTotal!: number;

  @ApiProperty({ enum: ProductPricingType })
  productTypeSnapshot!: ProductPricingType;
}

export class OrderResponseDto {
  @ApiProperty({ example: 'order-uuid' })
  id!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ enum: OrderKind })
  orderKind!: OrderKind;

  @ApiProperty({ example: 250000 })
  subtotal!: number;

  @ApiProperty({ enum: DiscountType })
  discountType!: DiscountType;

  @ApiProperty({ example: 0 })
  discountValue!: number;

  @ApiProperty({ example: 250000 })
  total!: number;

  @ApiProperty({ example: 'TOMAN' })
  currency!: string;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];

  @ApiProperty({ example: '2024-01-01T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: null, nullable: true })
  paidAt!: string | null;
}
