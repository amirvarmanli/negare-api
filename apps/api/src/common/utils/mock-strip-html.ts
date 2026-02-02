import type { Opts, Res } from 'string-strip-html';

const ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[\da-fA-F]+|#\d+|[a-zA-Z]+);/g,
    (_, entity: string) => {
      if (entity.startsWith('#x')) {
        return String.fromCharCode(parseInt(entity.slice(2), 16));
      }
      if (entity.startsWith('#')) {
        return String.fromCharCode(parseInt(entity.slice(1), 10));
      }
      return ENTITY_MAP[entity] ?? '';
    },
  );
}

export function stripHtml(text: string, _opts?: Partial<Opts>): Res {
  const plain = decodeEntities(text).replace(/<\/?[^>]+>/g, ' ');
  return {
    log: { timeTakenInMilliseconds: 0 },
    result: plain,
    ranges: null,
    allTagLocations: [],
    filteredTagLocations: [],
  };
}
