import { normalizeFaText, tokenizeFaText } from '@shared-slug/search/fa-search.util';

describe('fa-search utils', () => {
  it('normalizes Arabic variants and diacritics', () => {
    const input = 'شَهيد كاظِم يوسُف';
    expect(normalizeFaText(input)).toBe('شهید کاظم یوسف');
  });

  it('normalizes punctuation and whitespace', () => {
    const input = 'شهید\u200Cمحمدحسین، بهشتی';
    expect(normalizeFaText(input)).toBe('شهید محمدحسین بهشتی');
  });

  it('tokenizes normalized text', () => {
    const input = '  شهید   بهشتی ';
    expect(tokenizeFaText(input)).toEqual(['شهید', 'بهشتی']);
  });
});
