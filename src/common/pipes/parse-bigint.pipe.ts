import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string, _metadata: ArgumentMetadata): bigint {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException('Value must be a bigint compatible string');
    }

    if (!/^-?\d+$/.test(value)) {
      throw new BadRequestException('Validation failed (bigint string expected)');
    }

    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException('Validation failed (unable to parse bigint)');
    }
  }
}
