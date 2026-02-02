import { validate } from 'class-validator';
import { MaxPlainTextLength } from '@app/common/validators/max-plain-text-length.decorator';
import { countPlainTextCharacters } from '@app/common/utils/plain-text.util';

class DescriptionDto {
  @MaxPlainTextLength(5, {
    message: 'Too long',
    errorCode: 'TEST_TOO_LONG',
  })
  description?: string;
}

class NormalizedDescriptionDto {
  @MaxPlainTextLength(8, {
    message: 'Normalized text exceeded limit',
    errorCode: 'TEST_NORMALIZED',
  })
  description?: string;
}

describe('MaxPlainTextLength', () => {
  it('allows html-rich strings whose plain text stays within the limit', async () => {
    const dto = new DescriptionDto();
    dto.description = '<p>Hello</p>';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when the normalized plain text exceeds the limit even if the html is stripped away', async () => {
    const dto = new DescriptionDto();
    dto.description = '<div>LongText</div><span>More</span>';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);

    const constraintKey = Object.keys(errors[0].constraints ?? {})[0];
    expect(constraintKey).toBeDefined();
    expect(errors[0].constraints?.[constraintKey]).toBe('Too long');
    expect(errors[0].contexts?.[constraintKey]?.errorCode).toBe('TEST_TOO_LONG');
    expect(errors[0].contexts?.[constraintKey]?.maxLength).toBe(5);
  });

  it('counts entities and repeated whitespace only once while enforcing the limit', async () => {
    const html =
      '&nbsp;<strong>Alpha</strong>&nbsp;&nbsp;&nbsp;<em>Beta</em>&nbsp;';
    expect(countPlainTextCharacters(html)).toBe(10);

    const dto = new NormalizedDescriptionDto();
    dto.description = html;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);

    const constraintKey = Object.keys(errors[0].constraints ?? {})[0];
    expect(errors[0].contexts?.[constraintKey]?.errorCode).toBe(
      'TEST_NORMALIZED',
    );
    expect(errors[0].contexts?.[constraintKey]?.maxLength).toBe(8);
  });
});
