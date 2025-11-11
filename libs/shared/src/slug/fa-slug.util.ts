// libs/shared/src/slug/fa-slug.util.ts
/**
 * Persian slug normalization utilities shared across Category/Topic/Product modules.
 */

/**
 * Regex used by DTO validation to ensure slug segments only contain whitelisted characters.
 * Pattern: at least one segment, segments separated by single hyphen,
 * each segment limited to Persian letters, digits, or ASCII letters.
 */
export const FA_SLUG_REGEX =
  /^[\u0600-\u06FF0-9a-zA-Z]+(?:-[\u0600-\u06FF0-9a-zA-Z]+)*$/u;

export const FA_SLUG_MAX_LENGTH = 200;

export function clampFaSlug(slug: string): string {
  return slug.length > FA_SLUG_MAX_LENGTH ? slug.slice(0, FA_SLUG_MAX_LENGTH) : slug;
}

/**
 * Persian slug normalization:
 * - NFC normalize
 * - Arabic ya/kaf -> Persian ی/ک
 * - remove zero-width & diacritics
 * - collapse spaces -> single space
 * - trim
 */
export function normalizeFaText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/ي/gu, 'ی')
    .replace(/ك/gu, 'ک')
    .replace(/[\u200B-\u200F\u061C\u06D4]/gu, '') // zero-width & Arabic full stop
    .replace(/\s+/gu, ' ')
    .trim();
}

export function makeFaSlug(input: string): string {
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
export function safeDecodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
