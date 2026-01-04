-- AlterTable
ALTER TABLE "catalog"."products"
ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pinnedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "products_pinned_idx" ON "catalog"."products"("isPinned", "pinnedAt");

-- CreateIndex
CREATE INDEX "products_updated_at_idx" ON "catalog"."products"("updatedAt");

-- CreateIndex
CREATE INDEX "products_price_idx" ON "catalog"."products"("price");

-- CreateIndex
CREATE INDEX "products_title_idx" ON "catalog"."products"("title");
