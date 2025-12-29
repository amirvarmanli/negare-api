import { ApiProperty } from '@nestjs/swagger';
import { EntitlementSource, ProductPricingType, SubscriptionPlanCode } from '@app/finance/common/finance.enums';

export class DownloadDecisionDto {
  @ApiProperty({ example: true })
  allowed!: boolean;

  @ApiProperty({ enum: EntitlementSource, required: false })
  source?: EntitlementSource;

  @ApiProperty({ example: 'PURCHASED' })
  reason!: string;

  @ApiProperty({ enum: ProductPricingType })
  productType!: ProductPricingType;

  @ApiProperty({ example: 'https://cdn.example.com/file', required: false })
  signedUrl?: string | null;

  @ApiProperty({ example: 'products/1024/file.zip', required: false })
  storageKey?: string | null;
}

export class QuotaStatusDto {
  @ApiProperty({ example: 2 })
  usedFree!: number;

  @ApiProperty({ example: 10 })
  freeLimit!: number;

  @ApiProperty({ example: 1 })
  usedSub!: number;

  @ApiProperty({ example: 2 })
  subLimit!: number;

  @ApiProperty({ example: true })
  hasSubscription!: boolean;

  @ApiProperty({ enum: SubscriptionPlanCode, required: false })
  planCode?: SubscriptionPlanCode;
}
