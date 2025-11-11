"use strict";
// libs/shared/src/slug/fa-slug.util.ts
/**
 * Persian slug normalization utilities shared across Category/Topic/Product modules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FA_SLUG_MAX_LENGTH = exports.FA_SLUG_REGEX = void 0;
exports.clampFaSlug = clampFaSlug;
exports.normalizeFaText = normalizeFaText;
exports.makeFaSlug = makeFaSlug;
exports.safeDecodeSlug = safeDecodeSlug;
/**
 * Regex used by DTO validation to ensure slug segments only contain whitelisted characters.
 * Pattern: at least one segment, segments separated by single hyphen,
 * each segment limited to Persian letters, digits, or ASCII letters.
 */
exports.FA_SLUG_REGEX = /^[\u0600-\u06FF0-9a-zA-Z]+(?:-[\u0600-\u06FF0-9a-zA-Z]+)*$/u;
exports.FA_SLUG_MAX_LENGTH = 200;
function clampFaSlug(slug) {
    return slug.length > exports.FA_SLUG_MAX_LENGTH ? slug.slice(0, exports.FA_SLUG_MAX_LENGTH) : slug;
}
/**
 * Persian slug normalization:
 * - NFC normalize
 * - Arabic ya/kaf -> Persian ی/ک
 * - remove zero-width & diacritics
 * - collapse spaces -> single space
 * - trim
 */
function normalizeFaText(input) {
    return input
        .normalize('NFC')
        .replace(/ي/gu, 'ی')
        .replace(/ك/gu, 'ک')
        .replace(/[\u200B-\u200F\u061C\u06D4]/gu, '') // zero-width & Arabic full stop
        .replace(/\s+/gu, ' ')
        .trim();
}
function makeFaSlug(input) {
    const s = normalizeFaText(input)
        .replace(/\s+/gu, '-')
        .replace(/-+/gu, '-')
        .replace(/^-+|-+$/gu, '');
    // whitelist allowed characters only
    const whitelisted = s
        .split('')
        .filter((ch) => /[\u0600-\u06FF0-9a-zA-Z-]/u.test(ch)) // allow Persian letters, digits, optional Latin, and '-'
        .join('');
    const compacted = whitelisted.replace(/-+/gu, '-').replace(/^-+|-+$/gu, '');
    return clampFaSlug(compacted);
}
/** Defensive decode for route params (handles double-encoded inputs safely). */
function safeDecodeSlug(raw) {
    try {
        return decodeURIComponent(raw);
    }
    catch {
        return raw;
    }
}
