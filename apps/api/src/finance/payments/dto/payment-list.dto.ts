import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentProvider,
  PaymentReferenceType,
  PaymentStatus,
} from '@app/finance/common/finance.enums';
import { PaginationMetaDto } from '@app/common/dto/pagination.dto';

export class PaymentListItemDto {
  @ApiProperty({ example: 'payment-uuid' })
  id!: string;

  @ApiProperty({ nullable: true, example: 'order-uuid' })
  orderId!: string | null;

  @ApiProperty({ enum: PaymentReferenceType, nullable: true })
  referenceType!: PaymentReferenceType | null;

  @ApiProperty({ example: 'reference-id', nullable: true })
  referenceId!: string | null;

  @ApiProperty({ enum: PaymentProvider })
  provider!: PaymentProvider;

  @ApiProperty({
    enum: PaymentStatus,
    description: 'PENDING (awaiting gateway), SUCCESS, FAILED, CANCELED.',
  })
  status!: PaymentStatus;

  @ApiProperty({ example: 250000 })
  amount!: number;

  @ApiProperty({ example: 'TOMAN' })
  currency!: string;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2025-01-01T12:05:00.000Z', nullable: true })
  paidAt!: string | null;
}

export class PaymentListResponseDto {
  @ApiProperty({ type: [PaymentListItemDto] })
  items!: PaymentListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
