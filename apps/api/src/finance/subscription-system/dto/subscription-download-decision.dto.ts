import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionDownloadType } from '@app/finance/subscription-system/subscription-system.enums';

export class SubscriptionDownloadDecisionDto {
  @ApiProperty({ example: true })
  allowed!: boolean;

  @ApiProperty({ enum: SubscriptionDownloadType })
  downloadType!: SubscriptionDownloadType;

  @ApiProperty({ example: 'FREE_LIMIT_OK' })
  reason!: string;

  @ApiPropertyOptional({ example: 'subscription-uuid', nullable: true })
  subscriptionId?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/download', nullable: true })
  signedUrl?: string | null;

  @ApiPropertyOptional({ example: 'products/1024/file.zip', nullable: true })
  storageKey?: string | null;
}
