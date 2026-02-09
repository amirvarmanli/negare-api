import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EntitlementSource,
  ProductPricingType,
  SubscriptionPlanCode,
  SubscriptionStatus,
} from '@app/finance/common/finance.enums';

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

export class DownloadQuotaSummaryDto {
  @ApiProperty({ example: 5 })
  used!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 5 })
  remaining!: number;
}

export class SubscriptionPlanSummaryDto {
  @ApiProperty({ example: 'plan-123' })
  id!: string;

  @ApiProperty({ example: 'Pro' })
  title!: string;

  @ApiProperty({ example: '2026-02-06T12:30:00.000Z' })
  expiresAt!: string;
}

export class DownloadLimitsSummaryDto {
  @ApiProperty({ type: DownloadQuotaSummaryDto })
  freeDownloads!: DownloadQuotaSummaryDto;

  @ApiProperty({ type: DownloadQuotaSummaryDto })
  subscriptionDownloads!: DownloadQuotaSummaryDto;

  @ApiProperty({ example: true })
  hasActiveSubscription!: boolean;

  @ApiProperty({ enum: ['NONE', ...Object.values(SubscriptionStatus)] })
  subscriptionStatus!: SubscriptionStatus | 'NONE';

  @ApiPropertyOptional({ type: SubscriptionPlanSummaryDto })
  subscriptionPlan?: SubscriptionPlanSummaryDto | null;

  @ApiPropertyOptional({ example: 'SUBSCRIPTION_DATA_INCONSISTENT' })
  warning?: string;
}
