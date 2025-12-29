import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { IsString, IsUUID } from 'class-validator';

export class PaymentStatusResponseDto {
  @ApiProperty({ example: 'payment-uuid' })
  id!: string;

  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({ required: false, example: 'order-request-uuid' })
  orderRequestId!: string | null;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ example: 2100000 })
  amountToman!: number;

  @ApiProperty({ required: false, example: 3 })
  imageCount?: number;

  @ApiProperty({ required: false, example: 'https://cdn.example.com/uploads/file.zip' })
  fileUrl?: string;

  @ApiProperty({ required: false, example: '123456' })
  trackId?: string | null;

  @ApiProperty({ required: false, example: 'https://gateway.zibal.ir/start/123456' })
  redirectUrl?: string | null;

  @ApiProperty({ required: false, example: '2025-01-01T10:00:00.000Z' })
  createdAt?: string;
}

export class PaymentCallbackResponseDto {
  @ApiProperty({ example: 'payment-uuid' })
  paymentId!: string;

  @ApiProperty({ example: 'order-request-uuid' })
  orderRequestId!: string;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;
}

export class PaymentVerifyRequestDto {
  @ApiProperty({ example: 'payment-uuid' })
  @IsString()
  @IsUUID()
  paymentId!: string;
}
