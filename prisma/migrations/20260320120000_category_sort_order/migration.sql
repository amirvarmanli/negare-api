-- AlterTable
ALTER TABLE "catalog"."categories"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Backfill sort_order per parent group (fallback to id when created_at is unavailable)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY id ASC) - 1 AS rn
  FROM "catalog"."categories"
)
UPDATE "catalog"."categories" c
SET "sort_order" = ranked.rn
FROM ranked
WHERE c.id = ranked.id;
