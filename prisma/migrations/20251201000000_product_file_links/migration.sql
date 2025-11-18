-- Link product_files directly to products and optional uploaded file IDs
ALTER TABLE "catalog"."product_files" ADD COLUMN "product_id" BIGINT;
ALTER TABLE "catalog"."product_files" ADD COLUMN "file_id" TEXT;

UPDATE "catalog"."product_files" pf
SET "product_id" = p.id
FROM "catalog"."products" p
WHERE p."file_id" = pf.id;

DELETE FROM "catalog"."product_files" WHERE "product_id" IS NULL;

ALTER TABLE "catalog"."product_files" ALTER COLUMN "product_id" SET NOT NULL;

ALTER TABLE "catalog"."product_files"
  ADD CONSTRAINT "product_files_product_id_key" UNIQUE ("product_id");
ALTER TABLE "catalog"."product_files"
  ADD CONSTRAINT "product_files_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog"."product_files"
  ADD CONSTRAINT "product_files_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "core"."File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "catalog"."products" DROP CONSTRAINT IF EXISTS "products_file_id_fkey";
ALTER TABLE "catalog"."products" DROP COLUMN IF EXISTS "file_id";
DROP INDEX IF EXISTS "catalog"."products_file_id_key";