import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubscriptionPurchaseDto } from './subscription-purchase.dto';

describe('SubscriptionPurchaseDto', () => {
  it('requires a planId', async () => {
    const dto = plainToInstance(SubscriptionPurchaseDto, {});
    const errors = await validate(dto);
    expect(
      errors.some((error) =>
        error.constraints && 'isUuid' in error.constraints,
      ),
    ).toBe(true);
  });

  it('accepts a valid planId', async () => {
    const dto = plainToInstance(SubscriptionPurchaseDto, {
      planId: '00000000-0000-0000-0000-000000000000',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
