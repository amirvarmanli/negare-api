import { randomInt } from 'node:crypto';

const MAX_RANDOM = 9999;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function buildUniqueSlugCandidate(base: string, attempt = 0): string {
  if (attempt === 0) {
    return slugify(base);
  }
  const suffix = (attempt < 5 ? attempt : randomInt(1, MAX_RANDOM + 1))
    .toString()
    .padStart(attempt < 5 ? 0 : 4, '0');
  return `${slugify(base)}-${suffix}`;
}

