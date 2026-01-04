-- AlterEnum
ALTER TYPE "catalog"."enum_content_publication_status" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "catalog"."enum_content_publication_status" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "catalog"."enum_content_publication_status" ADD VALUE IF NOT EXISTS 'REJECTED';

-- AlterTable
ALTER TABLE "catalog"."blog_posts"
ADD COLUMN "reviewed_by_admin_id" UUID,
ADD COLUMN "reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN "reject_reason" VARCHAR(500),
ADD COLUMN "archived_at" TIMESTAMPTZ(6);

ALTER TABLE "catalog"."newsletter_issues"
ADD COLUMN "reviewed_by_admin_id" UUID,
ADD COLUMN "reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN "reject_reason" VARCHAR(500),
ADD COLUMN "archived_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "blog_posts_status_idx" ON "catalog"."blog_posts"("status");
CREATE INDEX "blog_posts_author_idx" ON "catalog"."blog_posts"("author_id");
CREATE INDEX "blog_posts_created_at_idx" ON "catalog"."blog_posts"("created_at");

CREATE INDEX "newsletter_issues_status_idx" ON "catalog"."newsletter_issues"("status");
CREATE INDEX "newsletter_issues_author_idx" ON "catalog"."newsletter_issues"("author_id");
CREATE INDEX "newsletter_issues_created_at_idx" ON "catalog"."newsletter_issues"("created_at");
