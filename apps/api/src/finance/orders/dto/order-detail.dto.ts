import { ApiProperty } from '@nestjs/swagger';
import {
  EntitlementSource,
  OrderKind,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from '@app/finance/common/finance.enums';

export class OrderDetailItemDto {
  @ApiProperty({ example: 'item-uuid' })
  id!: string;

  @ApiProperty({ example: '1024' })
  productId!: string;

  @ApiProperty({ example: 'Premium Pack' })
  productTitle!: string;

  @ApiProperty({ example: 250000 })
  unitPriceSnapshot!: number;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 250000 })
  subtotal!: number;
}

export class OrderDetailPaymentDto {
  @ApiProperty({ example: 'payment-uuid' })
  id!: string;

  @ApiProperty({ enum: PaymentProvider })
  provider!: PaymentProvider;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ example: '123456', nullable: true })
  trackId!: string | null;

  @ApiProperty({
    example: '123456',
    nullable: true,
    description: 'Legacy field; equals trackId for Zibal.',
  })
  authority!: string | null;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiProperty({ example: '2024-01-01T10:00:00.000Z' })
  createdAt!: string;
}

export class OrderDetailEntitlementDto {
  @ApiProperty({ example: '1024' })
  productId!: string;

  @ApiProperty({ enum: EntitlementSource })
  source!: EntitlementSource;

  @ApiProperty({ example: '2024-01-01T10:00:00.000Z' })
  createdAt!: string;
}

export class OrderDetailDto {
  @ApiProperty({ example: 'order-uuid' })
  id!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ enum: OrderKind })
  orderKind!: OrderKind;

  @ApiProperty({ example: 250000 })
  total!: number;

  @ApiProperty({ example: 'TOMAN' })
  currency!: string;

  @ApiProperty({ example: '2024-01-01T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: [OrderDetailItemDto] })
  items!: OrderDetailItemDto[];

  @ApiProperty({ type: [OrderDetailPaymentDto] })
  payments!: OrderDetailPaymentDto[];

  @ApiProperty({ type: [OrderDetailEntitlementDto] })
  entitlements!: OrderDetailEntitlementDto[];
}
