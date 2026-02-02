-- Alter rich text columns to text to allow longer HTML payloads
ALTER TABLE "catalog"."products"
  ALTER COLUMN "description" TYPE text;

ALTER TABLE "catalog"."products"
  ALTER COLUMN "seoDescription" TYPE text;
