-- CreateEnum
CREATE TYPE "catalog"."enum_content_publication_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_comment_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "catalog"."blog_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" CITEXT NOT NULL,
    "description" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."blog_posts" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" CITEXT NOT NULL,
    "excerpt" VARCHAR(600),
    "content" TEXT NOT NULL,
    "cover_image_url" VARCHAR(1024),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "status" "catalog"."enum_content_publication_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "category_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."blog_comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" VARCHAR(2000) NOT NULL,
    "status" "catalog"."enum_content_comment_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blog_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."newsletter_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" CITEXT NOT NULL,
    "description" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "newsletter_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."newsletter_issues" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" CITEXT NOT NULL,
    "excerpt" VARCHAR(600),
    "content" TEXT NOT NULL,
    "cover_image_url" VARCHAR(1024),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "status" "catalog"."enum_content_publication_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "category_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,

    CONSTRAINT "newsletter_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."newsletter_comments" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" VARCHAR(2000) NOT NULL,
    "status" "catalog"."enum_content_comment_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "newsletter_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "catalog"."blog_categories"("slug");

-- CreateIndex
CREATE INDEX "blog_categories_active_idx" ON "catalog"."blog_categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "catalog"."blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_pub_idx" ON "catalog"."blog_posts"("status", "published_at");

-- CreateIndex
CREATE INDEX "blog_posts_category_idx" ON "catalog"."blog_posts"("category_id");

-- CreateIndex
CREATE INDEX "blog_comments_post_status_idx" ON "catalog"."blog_comments"("post_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_categories_slug_key" ON "catalog"."newsletter_categories"("slug");

-- CreateIndex
CREATE INDEX "newsletter_categories_active_idx" ON "catalog"."newsletter_categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_issues_slug_key" ON "catalog"."newsletter_issues"("slug");

-- CreateIndex
CREATE INDEX "newsletter_issue_status_pub_idx" ON "catalog"."newsletter_issues"("status", "published_at");

-- CreateIndex
CREATE INDEX "newsletter_issue_category_idx" ON "catalog"."newsletter_issues"("category_id");

-- CreateIndex
CREATE INDEX "newsletter_comments_issue_status_idx" ON "catalog"."newsletter_comments"("issue_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "catalog"."blog_categories" ADD CONSTRAINT "blog_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog"."blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog"."blog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."blog_comments" ADD CONSTRAINT "blog_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."blog_comments" ADD CONSTRAINT "blog_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "catalog"."blog_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."blog_comments" ADD CONSTRAINT "blog_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog"."blog_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."newsletter_categories" ADD CONSTRAINT "newsletter_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog"."newsletter_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."newsletter_issues" ADD CONSTRAINT "newsletter_issues_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog"."newsletter_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."newsletter_issues" ADD CONSTRAINT "newsletter_issues_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."newsletter_comments" ADD CONSTRAINT "newsletter_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."newsletter_comments" ADD CONSTRAINT "newsletter_comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "catalog"."newsletter_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."newsletter_comments" ADD CONSTRAINT "newsletter_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog"."newsletter_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
