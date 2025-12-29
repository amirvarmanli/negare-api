const DIACRITICS_REGEX =
  /[\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u061C]/gu;
const PUNCTUATION_REGEX =
  /[.,;:!?؟،؛"“”'`~^|\\/()\[\]{}<>«»=+*_‐‑‑–—-]/gu;

export function normalizeFaText(input: string): string {
  return (
    input
      .normalize('NFC')
      .replace(/ي/gu, 'ی')
      .replace(/ك/gu, 'ک')
      .replace(DIACRITICS_REGEX, '')
      .replace(/\u200C/gu, ' ') // ZWNJ -> space
      .replace(ZERO_WIDTH_REGEX, '')
      .replace(PUNCTUATION_REGEX, ' ')
      .toLowerCase()
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

export function tokenizeFaText(input: string): string[] {
  const normalized = normalizeFaText(input);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 0);
}
