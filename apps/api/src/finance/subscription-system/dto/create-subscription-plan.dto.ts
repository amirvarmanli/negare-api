import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Starter' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 150000 })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  durationDays!: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(0)
  dailyDownloadLimit!: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  dailyFreeDownloadLimitWithSubscription!: number;

  @ApiPropertyOptional({ example: 'Basic plan description.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: [{ label: 'Premium exports' }] })
  @IsOptional()
  features?: Record<string, unknown> | null;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;

  @ApiPropertyOptional({
    example: 10,
    description: 'Percentage applied per discounted subscription purchase.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Total discounted purchases allowed per user for the lifetime of the subscription (not daily, not per billing cycle).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  discountQuota?: number;
}
