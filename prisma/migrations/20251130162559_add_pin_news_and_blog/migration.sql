-- CreateEnum
CREATE TYPE "catalog"."BlogSectionMediaType" AS ENUM ('image', 'video');

-- AlterTable
ALTER TABLE "catalog"."blog_posts" ADD COLUMN     "browser_title" VARCHAR(70),
ADD COLUMN     "is_pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preview_cover_url" VARCHAR(1024);

-- AlterTable
ALTER TABLE "catalog"."newsletter_issues" ADD COLUMN     "browser_title" VARCHAR(70),
ADD COLUMN     "file_url" VARCHAR(1024),
ADD COLUMN     "is_pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "catalog"."blog_post_sections" (
    "id" UUID NOT NULL,
    "blog_post_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "media_url" VARCHAR(1024),
    "media_type" "catalog"."BlogSectionMediaType",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blog_post_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."newsletter_sections" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "newsletter_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blog_post_sections_post_order_idx" ON "catalog"."blog_post_sections"("blog_post_id", "order");

-- CreateIndex
CREATE INDEX "newsletter_sections_issue_order_idx" ON "catalog"."newsletter_sections"("issue_id", "order");

-- AddForeignKey
ALTER TABLE "catalog"."blog_post_sections" ADD CONSTRAINT "blog_post_sections_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "catalog"."blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."newsletter_sections" ADD CONSTRAINT "newsletter_sections_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "catalog"."newsletter_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
