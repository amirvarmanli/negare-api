-- Enable trigram search extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add normalized search text column
ALTER TABLE "catalog"."products"
  ADD COLUMN IF NOT EXISTS "search_text_normalized" TEXT;

-- Backfill normalized search text
UPDATE "catalog"."products"
SET "search_text_normalized" = NULLIF(
  trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(
            lower(
              replace(
                replace(
                  coalesce("title", '') || ' ' ||
                  coalesce("description", '') || ' ' ||
                  coalesce("seoTitle", '') || ' ' ||
                  coalesce("seoDescription", '') || ' ' ||
                  coalesce("slug", ''),
                  'ي',
                  'ی'
                ),
                'ك',
                'ک'
              )
            ),
            'ًٌٍَُِّْٰ',
            ''
          ),
          '‌',
          ' ',
          'g'
        ),
        '[\.,;:!?؟،؛"“”''`~^|\\/()\[\]{}<>«»=+*_‐‑–—-]',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  ),
  ''
);

-- Trigram index for token/phrase search
CREATE INDEX IF NOT EXISTS "products_search_text_trgm_idx"
  ON "catalog"."products"
  USING GIN ("search_text_normalized" gin_trgm_ops);
