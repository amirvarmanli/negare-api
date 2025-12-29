import { ApiProperty } from '@nestjs/swagger';

export type PurchaseResultStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export class PurchaseResultDownloadDto {
  @ApiProperty({ example: '42' })
  fileId!: string;

  @ApiProperty({ example: 'sample.zip' })
  filename!: string;

  @ApiProperty({
    description: 'Secure download URL or protected API endpoint.',
    example: 'http://localhost:4000/api/downloads/files/42?token=...',
  })
  url!: string;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ required: false, example: 1048576 })
  sizeBytes?: number;

  @ApiProperty({ required: false, example: 'application/zip' })
  mimeType?: string;
}

export class PurchaseResultItemDto {
  @ApiProperty({ example: '1024' })
  productId!: string;

  @ApiProperty({ example: 'Premium Pack' })
  title!: string;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/covers/1.png' })
  coverUrl!: string | null;

  @ApiProperty({ enum: ['FREE', 'PAID', 'SUBSCRIPTION', 'PAID_OR_SUBSCRIPTION'] })
  pricingType!: 'FREE' | 'PAID' | 'SUBSCRIPTION' | 'PAID_OR_SUBSCRIPTION';

  @ApiProperty({ type: [PurchaseResultDownloadDto] })
  downloads!: PurchaseResultDownloadDto[];
}

export class PurchaseResultDto {
  @ApiProperty({ example: 'order-uuid' })
  orderId!: string;

  @ApiProperty({ enum: ['SUCCESS', 'FAILED', 'PENDING'] })
  status!: PurchaseResultStatus;

  @ApiProperty({ required: false, example: '2025-01-01T12:00:00.000Z' })
  paidAt?: string;

  @ApiProperty({ example: 250000 })
  totalAmount!: number;

  @ApiProperty({ type: [PurchaseResultItemDto] })
  items!: PurchaseResultItemDto[];
}
