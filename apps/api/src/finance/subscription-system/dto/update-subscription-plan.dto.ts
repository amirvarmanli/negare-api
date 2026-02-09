import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional({ example: 'Starter' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyDownloadLimit?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyFreeDownloadLimitWithSubscription?: number;

  @ApiPropertyOptional({ example: 'Basic plan description.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: [{ label: 'Premium exports' }] })
  @IsOptional()
  features?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 10,
    description: 'Percentage applied per discounted subscription purchase.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent?: number | null;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Total discounted purchases allowed per user for the lifetime of the subscription (not daily, not per billing cycle).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  discountQuota?: number | null;
}
