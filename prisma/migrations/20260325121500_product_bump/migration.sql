-- DropIndex
DROP INDEX IF EXISTS "catalog"."products_pinned_idx";

-- AlterTable
ALTER TABLE "catalog"."products"
DROP COLUMN IF EXISTS "isPinned";

-- CreateIndex
CREATE INDEX "products_pinned_at_created_at_idx" ON "catalog"."products"("pinnedAt", "createdAt");
