import { ApiProperty } from '@nestjs/swagger';
import { Messenger, OrderFileKind, PaymentStatus } from '@prisma/client';

export class OrderRequestDto {
  @ApiProperty({ example: 'order-request-uuid' })
  id!: string;

  @ApiProperty({ example: 'Martyr Example' })
  fullName!: string;

  @ApiProperty({ enum: Messenger })
  messenger!: Messenger;

  @ApiProperty({ example: '09123456789' })
  phoneNumber!: string;

  @ApiProperty({ required: false })
  description?: string | null;

  @ApiProperty({ example: 3 })
  imageCount!: number;

  @ApiProperty({ example: 2100000 })
  amountToman!: number;

  @ApiProperty({ example: 'https://cdn.example.com/uploads/file.zip' })
  fileUrl!: string;

  @ApiProperty({ required: false, example: 'FRONTEND_UPLOAD' })
  fileSource?: string | null;

  @ApiProperty({ enum: OrderFileKind, required: false })
  fileKind?: OrderFileKind | null;

  @ApiProperty({ example: '2025-01-01T10:00:00.000Z' })
  createdAt!: Date;
}

export class OrderRequestPaymentDto {
  @ApiProperty({ example: 'payment-uuid' })
  id!: string;

  @ApiProperty({ example: 2100000 })
  amountToman!: number;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ required: false, example: '123456' })
  trackId?: string | null;

  @ApiProperty({ required: false, example: 'https://gateway.zibal.ir/start/123456' })
  redirectUrl?: string | null;
}

export class OrderRequestCreateResponseDto {
  @ApiProperty({ type: OrderRequestDto })
  orderRequest!: OrderRequestDto;

  @ApiProperty({ type: OrderRequestPaymentDto })
  payment!: OrderRequestPaymentDto;
}

export class OrderRequestDetailResponseDto {
  @ApiProperty({ type: OrderRequestDto })
  orderRequest!: OrderRequestDto;

  @ApiProperty({ type: OrderRequestPaymentDto })
  payment!: OrderRequestPaymentDto | null;
}
