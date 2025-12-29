import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { PaymentReferenceType } from '@app/finance/common/finance.enums';

export class WalletPayDto {
  @ApiProperty({
    enum: [PaymentReferenceType.CART, PaymentReferenceType.SUBSCRIPTION],
    example: PaymentReferenceType.CART,
  })
  @IsIn([PaymentReferenceType.CART, PaymentReferenceType.SUBSCRIPTION])
  refType!: PaymentReferenceType.CART | PaymentReferenceType.SUBSCRIPTION;

  @ApiProperty({ example: 'cart-or-purchase-id' })
  @IsString()
  @MaxLength(64)
  refId!: string;
}

export class WalletPayResponseDto {
  @ApiProperty({ example: 'success' })
  status!: 'success';

  @ApiProperty({
    example: 'receipt-uuid',
    description: 'Order id for cart payments or purchase id for subscriptions.',
  })
  receiptId!: string;

  @ApiProperty({ example: 200000 })
  paidAmount!: number;

  @ApiProperty({ example: 150000 })
  newBalance!: number;
}
