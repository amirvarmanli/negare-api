import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AdminUsersListMetaDto } from '@app/core/users/admin/dto/admin-users-list.dto';
import { NotificationStatus } from '@prisma/client';

export enum AdminUserPurchasePaymentStatus {
  SUCCESS = 'SUCCESS',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export class AdminUserSubresourceQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AdminUserDownloadsQueryDto extends AdminUserSubresourceQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) =>
    value === true || value === 'true' || value === '1' ? true : false,
  )
  @IsBoolean()
  freeOnly?: boolean;
}

export class AdminUserPurchaseProductDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty()
  title!: string;
}

export class AdminUserPurchaseRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ example: 120000 })
  total!: number;

  @ApiProperty({ enum: AdminUserPurchasePaymentStatus })
  paymentStatus!: AdminUserPurchasePaymentStatus;

  @ApiProperty({ type: () => [AdminUserPurchaseProductDto] })
  products!: AdminUserPurchaseProductDto[];
}

export class AdminUserPurchasesResponseDto {
  @ApiProperty({ type: () => [AdminUserPurchaseRowDto] })
  items!: AdminUserPurchaseRowDto[];

  @ApiProperty({ type: () => AdminUsersListMetaDto })
  meta!: AdminUsersListMetaDto;
}

export class AdminUserDownloadProductDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  slug?: string | null;
}

export class AdminUserDownloadRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  occurredAt!: string;

  @ApiProperty()
  isFree!: boolean;

  @ApiProperty({ type: () => AdminUserDownloadProductDto })
  product!: AdminUserDownloadProductDto;

  @ApiPropertyOptional({ nullable: true })
  ip!: string | null;

  @ApiPropertyOptional({ nullable: true })
  userAgent!: string | null;
}

export class AdminUserDownloadsResponseDto {
  @ApiProperty({ type: () => [AdminUserDownloadRowDto] })
  items!: AdminUserDownloadRowDto[];

  @ApiProperty({ type: () => AdminUsersListMetaDto })
  meta!: AdminUsersListMetaDto;
}

export class AdminUserTransactionRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ example: -50000 })
  amount!: number;

  @ApiProperty()
  label!: string;

  @ApiPropertyOptional({ nullable: true })
  referenceId!: string | null;
}

export class AdminUserTransactionsResponseDto {
  @ApiProperty({ type: () => [AdminUserTransactionRowDto] })
  items!: AdminUserTransactionRowDto[];

  @ApiProperty({ type: () => AdminUsersListMetaDto })
  meta!: AdminUsersListMetaDto;
}

export class AdminUserNotificationRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  status!: NotificationStatus;
}

export class AdminUserNotificationsResponseDto {
  @ApiProperty({ type: () => [AdminUserNotificationRowDto] })
  items!: AdminUserNotificationRowDto[];

  @ApiProperty({ type: () => AdminUsersListMetaDto })
  meta!: AdminUsersListMetaDto;
}
