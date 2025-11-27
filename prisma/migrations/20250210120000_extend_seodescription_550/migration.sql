-- AlterTable
ALTER TABLE "catalog"."products"
  ALTER COLUMN "seoDescription" TYPE VARCHAR(550);

ALTER TABLE "catalog"."topics"
  ALTER COLUMN "seoDescription" TYPE VARCHAR(550);
