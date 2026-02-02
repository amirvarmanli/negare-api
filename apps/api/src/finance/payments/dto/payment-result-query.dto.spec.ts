import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentReferenceType } from '@app/finance/common/finance.enums';
import { PaymentResultQueryDto } from './payment-result-query.dto';

describe('PaymentResultQueryDto', () => {
  it('accepts referenceType/referenceId (canonical)', async () => {
    const dto = plainToInstance(PaymentResultQueryDto, {
      referenceType: 'cart',
      referenceId: 'order-uuid',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.referenceType).toBe(PaymentReferenceType.CART);
  });

  it('accepts refType/refId (legacy)', async () => {
    const dto = plainToInstance(PaymentResultQueryDto, {
      refType: 'cart',
      refId: 'order-uuid',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.refType).toBe(PaymentReferenceType.CART);
  });

  it('normalizes reference type to be case-insensitive', async () => {
    const dto = plainToInstance(PaymentResultQueryDto, {
      refType: 'CART',
      refId: 'order-uuid',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.refType).toBe(PaymentReferenceType.CART);
  });

  it('rejects invalid referenceType', async () => {
    const dto = plainToInstance(PaymentResultQueryDto, {
      referenceType: 'invalid',
      referenceId: 'order-uuid',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'referenceType')).toBe(true);
  });
});
