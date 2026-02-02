import { stripHtml } from 'string-strip-html';
const WHITESPACE_REGEXP = /[\s\u00A0]+/g;

export interface PlainTextMetrics {
  text: string;
  length: number;
}

function normalizeWhitespace(text: string): string {
  return text.replace(WHITESPACE_REGEXP, ' ').trim();
}

export function getPlainTextMetrics(value?: string | null): PlainTextMetrics {
  const raw =
    typeof value === 'string' ? value : value != null ? String(value) : '';
  const plain = stripHtml(raw).result;
  const normalized = normalizeWhitespace(plain);

  return {
    text: normalized,
    length: normalized.length,
  };
}

export function countPlainTextCharacters(value?: string | null): number {
  return getPlainTextMetrics(value).length;
}
