-- AlterTable
ALTER TABLE "catalog"."blog_posts"
ADD COLUMN "pinned_at" TIMESTAMPTZ(6),
ADD COLUMN "pinned_by_admin_id" UUID;

-- AlterTable
ALTER TABLE "catalog"."newsletter_issues"
ADD COLUMN "pinned_at" TIMESTAMPTZ(6),
ADD COLUMN "pinned_by_admin_id" UUID;
