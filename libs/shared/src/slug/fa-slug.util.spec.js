"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fa_slug_util_1 = require("./fa-slug.util");
describe('fa-slug.util', () => {
    it('normalizes Arabic ya/kaf variants and trims whitespace', () => {
        const result = (0, fa_slug_util_1.normalizeFaText)('  كاشي يي  ');
        expect(result).toBe('کاشی یی');
    });
    it('removes zero-width characters and collapses spaces', () => {
        const withZwnj = `کتاب\u200Cخانه\u200F`;
        const result = (0, fa_slug_util_1.normalizeFaText)(withZwnj);
        expect(result).toBe('کتابخانه');
    });
    it('creates slugs with collapsed hyphens and whitelisted chars', () => {
        const result = (0, fa_slug_util_1.makeFaSlug)('  طراحی   مدرن!! -- نسخه ۲ ');
        expect(result).toBe('طراحی-مدرن-نسخه-2');
    });
    it('strips leading/trailing hyphens and multiple hyphens', () => {
        const result = (0, fa_slug_util_1.makeFaSlug)('---نمونه---Slug---');
        expect(result).toBe('نمونه-Slug');
    });
    it('clamps slug length to 200 characters', () => {
        const longInput = 'الف'.repeat(220);
        const result = (0, fa_slug_util_1.makeFaSlug)(longInput);
        expect(result.length).toBeLessThanOrEqual(fa_slug_util_1.FA_SLUG_MAX_LENGTH);
    });
    it('safe-decodes percent-encoded slugs and survives double-encoding', () => {
        const encoded = encodeURIComponent('نقاشی-و-تصویرسازی');
        expect((0, fa_slug_util_1.safeDecodeSlug)(encoded)).toBe('نقاشی-و-تصویرسازی');
        const doubleEncoded = encodeURIComponent(encoded); // => %25D9...
        expect((0, fa_slug_util_1.safeDecodeSlug)(doubleEncoded)).toBe(encoded);
    });
});
