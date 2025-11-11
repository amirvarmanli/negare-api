import {
  FA_SLUG_MAX_LENGTH,
  makeFaSlug,
  normalizeFaText,
  safeDecodeSlug,
} from './fa-slug.util';

describe('fa-slug.util', () => {
  it('normalizes Arabic ya/kaf variants and trims whitespace', () => {
    const result = normalizeFaText('  كاشي يي  ');
    expect(result).toBe('کاشی یی');
  });

  it('removes zero-width characters and collapses spaces', () => {
    const withZwnj = `کتاب\u200Cخانه\u200F`;
    const result = normalizeFaText(withZwnj);
    expect(result).toBe('کتابخانه');
  });

  it('creates slugs with collapsed hyphens and whitelisted chars', () => {
    const result = makeFaSlug('  طراحی   مدرن!! -- نسخه ۲ ');
    expect(result).toBe('طراحی-مدرن-نسخه-2');
  });

  it('strips leading/trailing hyphens and multiple hyphens', () => {
    const result = makeFaSlug('---نمونه---Slug---');
    expect(result).toBe('نمونه-Slug');
  });

  it('clamps slug length to 200 characters', () => {
    const longInput = 'الف'.repeat(220);
    const result = makeFaSlug(longInput);
    expect(result.length).toBeLessThanOrEqual(FA_SLUG_MAX_LENGTH);
  });

  it('safe-decodes percent-encoded slugs and survives double-encoding', () => {
    const encoded = encodeURIComponent('نقاشی-و-تصویرسازی');
    expect(safeDecodeSlug(encoded)).toBe('نقاشی-و-تصویرسازی');

    const doubleEncoded = encodeURIComponent(encoded); // => %25D9...
    expect(safeDecodeSlug(doubleEncoded)).toBe(encoded);
  });
});
