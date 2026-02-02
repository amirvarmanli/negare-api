import { ApiProperty } from '@nestjs/swagger';
import { AdminPurchasePaymentStatus } from '@app/finance/purchases/dto/admin-purchases-query.dto';

export class AdminOrderBuyerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ required: false, nullable: true })
  phone?: string | null;

  @ApiProperty({ required: false, nullable: true })
  email?: string | null;
}

export class AdminOrderProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;
}

export class AdminOrderAmountDto {
  @ApiProperty()
  total!: number;
}

export class AdminOrderPaymentDto {
  @ApiProperty({ required: false, nullable: true })
  id?: string | null;

  @ApiProperty({ required: false, nullable: true })
  provider?: string | null;

  @ApiProperty({ required: false, nullable: true })
  trackId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  refId?: string | null;
}

export class AdminOrderRowDto {
  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: () => AdminOrderBuyerDto })
  buyer!: AdminOrderBuyerDto;

  @ApiProperty({ type: () => [AdminOrderProductDto] })
  products!: AdminOrderProductDto[];

  @ApiProperty({ type: () => AdminOrderAmountDto })
  amount!: AdminOrderAmountDto;

  @ApiProperty({ enum: AdminPurchasePaymentStatus })
  paymentStatus!: AdminPurchasePaymentStatus;

  @ApiProperty({ type: () => AdminOrderPaymentDto, required: false })
  payment?: AdminOrderPaymentDto;
}

export class AdminOrdersMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AdminOrdersListResponseDto {
  @ApiProperty({ type: () => [AdminOrderRowDto] })
  items!: AdminOrderRowDto[];

  @ApiProperty({ type: () => AdminOrdersMetaDto })
  meta!: AdminOrdersMetaDto;
}
