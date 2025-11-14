// libs/shared/src/slug/fa-slug.util.ts
/**
 * Persian slug normalization utilities shared across Category/Topic/Product modules.
 */

/** Regex: segments joined by '-', each segment Persian letters / digits / ASCII letters */
export const FA_SLUG_REGEX: RegExp =
  /^[\u0600-\u06FF0-9a-zA-Z]+(?:-[\u0600-\u06FF0-9a-zA-Z]+)*$/u;

export const FA_SLUG_MAX_LENGTH = 200;

/** Clamp slug length to FA_SLUG_MAX_LENGTH */
export function clampFaSlug(slug: string): string {
  return slug.length > FA_SLUG_MAX_LENGTH
    ? slug.slice(0, FA_SLUG_MAX_LENGTH)
    : slug;
}

/**
 * Persian text normalization:
 * - NFC normalize
 * - Arabic ya/kaf -> Persian ی/ک
 * - remove zero-width & diacritics
 * - collapse spaces -> single space
 * - trim
 */
export function normalizeFaText(input: string): string {
  return (
    input
      .normalize('NFC')
      .replace(/ي/gu, 'ی')
      .replace(/ك/gu, 'ک')
      // remove zero-width marks & Arabic full stop
      .replace(/[\u200B-\u200F\u061C\u06D4]/gu, '')
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

/** Make a whitelisted, compact Persian slug */
export function makeFaSlug(input: string): string {
  const s = normalizeFaText(input)
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  // keep only allowed chars: Persian letters, digits, ASCII letters, and '-'
  const whitelisted = s
    .split('')
    .filter((ch) => /[\u0600-\u06FF0-9a-zA-Z-]/u.test(ch))
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

/** Optional default export for convenience */
export default makeFaSlug;
