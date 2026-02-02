import { ApiProperty } from '@nestjs/swagger';
import { AdminCreditType } from '@app/finance/credits/dto/admin-credits-query.dto';

export class AdminCreditSupplierDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ required: false, nullable: true })
  phone?: string | null;

  @ApiProperty({ required: false, nullable: true })
  email?: string | null;

  @ApiProperty({ required: false, nullable: true })
  avatarUrl?: string | null;
}

export class AdminCreditAmountDto {
  @ApiProperty()
  total!: number;
}

export class AdminCreditProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;
}

export class AdminCreditSubscriptionDto {
  @ApiProperty()
  title!: string;
}

export class AdminCreditRowDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ enum: AdminCreditType })
  type!: AdminCreditType;

  @ApiProperty({ type: () => AdminCreditSupplierDto })
  supplier!: AdminCreditSupplierDto;

  @ApiProperty({ type: () => AdminCreditAmountDto })
  amount!: AdminCreditAmountDto;

  @ApiProperty({ type: () => AdminCreditProductDto, required: false })
  product?: AdminCreditProductDto;

  @ApiProperty({ type: () => AdminCreditSubscriptionDto, required: false })
  subscription?: AdminCreditSubscriptionDto;
}

export class AdminCreditsMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AdminCreditsListResponseDto {
  @ApiProperty({ type: () => [AdminCreditRowDto] })
  items!: AdminCreditRowDto[];

  @ApiProperty({ type: () => AdminCreditsMetaDto })
  meta!: AdminCreditsMetaDto;
}
