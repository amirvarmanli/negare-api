import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaymentReferenceType } from '@app/finance/common/finance.enums';

const toOptionalTrimmedString = ({
  value,
}: TransformFnParams): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
};

const toOptionalLowercaseString = ({
  value,
}: TransformFnParams): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed.toLowerCase() : '';
};

export class PaymentResultQueryDto {
  @ApiPropertyOptional({
    example: 'payment-uuid',
    description: 'Payment UUID. Highest priority when multiple params exist.',
  })
  @IsOptional()
  @IsUUID()
  @IsString()
  @MaxLength(128)
  @Transform(toOptionalTrimmedString)
  paymentId?: string;

  @ApiPropertyOptional({
    example: 'track-uuid',
    description: 'Gateway trackId. Used when paymentId is missing.',
  })
  @IsOptional()
  @ValidateIf((dto) => !dto.paymentId && dto.trackId !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Transform(toOptionalTrimmedString)
  trackId?: string;

  @ApiPropertyOptional({
    example: 'authority-uuid',
    description: 'Gateway authority/session id (alias of trackId).',
  })
  @IsOptional()
  @ValidateIf(
    (dto) => !dto.paymentId && dto.trackId === undefined && dto.authority !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Transform(toOptionalTrimmedString)
  authority?: string;

  @ApiPropertyOptional({
    enum: PaymentReferenceType,
    description:
      'Legacy reference type (alias of referenceType). Used when paymentId/trackId are missing.',
  })
  @IsOptional()
  @ValidateIf(
    (dto) => !dto.paymentId && !dto.trackId && dto.refType !== undefined,
  )
  @IsIn(Object.values(PaymentReferenceType))
  @Transform(toOptionalLowercaseString)
  refType?: PaymentReferenceType;

  @ApiPropertyOptional({
    example: 'reference-id',
    description:
      'Legacy reference id (alias of referenceId). Used when paymentId/trackId are missing.',
  })
  @IsOptional()
  @ValidateIf(
    (dto) => !dto.paymentId && !dto.trackId && dto.refId !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Transform(toOptionalTrimmedString)
  refId?: string;

  @ApiPropertyOptional({
    enum: PaymentReferenceType,
    description:
      'Reference type (canonical). Used when paymentId/trackId are missing. Case-insensitive.',
  })
  @IsOptional()
  @ValidateIf(
    (dto) => !dto.paymentId && !dto.trackId && dto.referenceType !== undefined,
  )
  @IsIn(Object.values(PaymentReferenceType))
  @Transform(toOptionalLowercaseString)
  referenceType?: PaymentReferenceType;

  @ApiPropertyOptional({
    example: 'reference-id',
    description:
      'Reference id (canonical). Used when paymentId/trackId are missing.',
  })
  @IsOptional()
  @ValidateIf(
    (dto) =>
      !dto.paymentId && !dto.trackId && dto.referenceId !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Transform(toOptionalTrimmedString)
  referenceId?: string;
}
