const DASH = '-';

/**
 * Generates a URL-friendly slug from an arbitrary string.
 */
export function createSlug(input: string): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '')
    .trim()
    .replace(/\s+/g, DASH)
    .replace(/-+/g, DASH)
    .toLowerCase();

  return normalized.length > 0 ? normalized : 'item';
}
