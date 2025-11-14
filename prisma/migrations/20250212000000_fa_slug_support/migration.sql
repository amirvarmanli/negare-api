-- Adjust slug columns to 200 chars and add parent index for categories

ALTER TABLE "catalog"."categories" ALTER COLUMN "slug" TYPE VARCHAR(200);
CREATE INDEX "categories_parent_idx" ON "catalog"."categories" ("parent_id");

ALTER TABLE "catalog"."products" ALTER COLUMN "slug" TYPE VARCHAR(200);
ALTER TABLE "catalog"."topics" ALTER COLUMN "slug" TYPE VARCHAR(200);

-- Create slug redirect table for future-safe slug changes
CREATE TABLE "catalog"."slug_redirects" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(32) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "fromSlug" VARCHAR(200) NOT NULL,
    "toSlug" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "slug_redirects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "slug_redirects_fromSlug_key" UNIQUE ("fromSlug")
);

CREATE INDEX "slug_redirect_entity_idx" ON "catalog"."slug_redirects" ("entityType", "entityId");
