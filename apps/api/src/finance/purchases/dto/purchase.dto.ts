import { ApiProperty } from '@nestjs/swagger';

export class PurchaseDownloadDto {
  @ApiProperty({ example: '42' })
  fileId!: string;

  @ApiProperty({
    description: 'Secure download URL (tokenized).',
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

export class PurchaseItemDto {
  @ApiProperty({ example: '1024' })
  productId!: string;

  @ApiProperty({ example: 'Premium Pack' })
  title!: string;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/covers/1.png' })
  coverUrl!: string | null;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  purchasedAt!: string;

  @ApiProperty({ example: 'order-uuid' })
  orderId!: string;

  @ApiProperty({ type: [PurchaseDownloadDto] })
  downloads!: PurchaseDownloadDto[];
}

export class PurchasesPageDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 120 })
  total!: number;

  @ApiProperty({ type: [PurchaseItemDto] })
  items!: PurchaseItemDto[];
}
