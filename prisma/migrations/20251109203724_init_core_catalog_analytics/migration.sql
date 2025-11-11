-- CreateSchema
-- Enable required extensions (also for Shadow DB)
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE SCHEMA IF NOT EXISTS "analytics";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalog";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateEnum
CREATE TYPE "core"."role_name_enum" AS ENUM ('user', 'supplier', 'admin');

-- CreateEnum
CREATE TYPE "core"."wallet_currency_enum" AS ENUM ('IRR');

-- CreateEnum
CREATE TYPE "core"."wallet_transaction_type_enum" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "core"."wallet_transaction_status_enum" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "core"."wallet_transaction_ref_type_enum" AS ENUM ('order', 'payout', 'adjustment');

-- CreateEnum
CREATE TYPE "core"."enum_otp_codes_channel" AS ENUM ('sms', 'email');

-- CreateEnum
CREATE TYPE "core"."enum_otp_codes_status" AS ENUM ('active', 'used', 'expired', 'blocked');

-- CreateEnum
CREATE TYPE "core"."enum_otp_codes_purpose" AS ENUM ('signup', 'login', 'reset');

-- CreateEnum
CREATE TYPE "core"."UserStatus" AS ENUM ('active', 'blocked', 'pending');

-- CreateEnum
CREATE TYPE "core"."SessionRevokeReason" AS ENUM ('logout', 'rotation', 'reuse_detected', 'admin');

-- CreateEnum
CREATE TYPE "core"."AuditAction" AS ENUM ('OTP_REQUEST', 'OTP_VERIFY_SUCCESS', 'OTP_VERIFY_FAIL', 'LOGIN_SUCCESS', 'LOGIN_FAIL', 'REFRESH_ROTATE', 'REFRESH_REUSE_DETECTED', 'LOGOUT', 'LOGOUT_ALL', 'PASSWORD_SET', 'PASSWORD_FORGOT_REQUEST', 'PASSWORD_RESET_SUCCESS', 'PASSWORD_RESET_FAIL');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_products_pricingType" AS ENUM ('FREE', 'SUBSCRIPTION', 'PAID', 'PAID_OR_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_products_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_products_graphicFormat" AS ENUM ('SVG', 'EPS', 'AI', 'PSD', 'PNG', 'JPG', 'WEBP');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_comment_target" AS ENUM ('PRODUCT', 'POST', 'NEWSLETTER');

-- CreateTable
CREATE TABLE "core"."users" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "username" CITEXT,
    "email" CITEXT,
    "phone" VARCHAR(32),
    "name" VARCHAR(255),
    "bio" TEXT,
    "city" VARCHAR(255),
    "avatarUrl" VARCHAR(255),
    "passwordHash" VARCHAR(255),
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "core"."UserStatus" NOT NULL DEFAULT 'active',
    "passwordChangedAt" TIMESTAMPTZ(6),
    "lastLoginAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshJti" UUID NOT NULL,
    "refreshTokenHash" VARCHAR(255) NOT NULL,
    "uaHash" VARCHAR(64),
    "ipHash" VARCHAR(64),
    "fingerprintHash" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "revokeReason" "core"."SessionRevokeReason",
    "rotatedFromJti" UUID,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "uaHash" VARCHAR(64),
    "ipHash" VARCHAR(64),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" "core"."AuditAction" NOT NULL,
    "meta" JSONB,
    "ipHash" VARCHAR(64),
    "uaHash" VARCHAR(64),
    "traceId" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."roles" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "name" "core"."role_name_enum" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."user_roles" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."wallets" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" "core"."wallet_currency_enum" NOT NULL DEFAULT 'IRR',

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."wallet_transactions" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "core"."wallet_transaction_type_enum" NOT NULL,
    "status" "core"."wallet_transaction_status_enum" NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(18,2) NOT NULL,
    "balance_after" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ref_type" "core"."wallet_transaction_ref_type_enum" NOT NULL,
    "ref_id" VARCHAR(255),
    "description" VARCHAR(1000),
    "idempotency_key" VARCHAR(255) NOT NULL,
    "external_ref" VARCHAR(255),
    "provider" VARCHAR(64),
    "group_id" UUID,
    "metadata" JSONB,
    "created_by_id" UUID,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."wallet_audit_logs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID,
    "wallet_id" UUID,
    "action" VARCHAR(64) NOT NULL,
    "meta" JSONB,

    CONSTRAINT "wallet_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."File" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."products" (
    "id" BIGSERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "coverUrl" VARCHAR(255),
    "file_id" BIGINT,
    "graphicFormats" "catalog"."enum_content_products_graphicFormat"[] DEFAULT ARRAY[]::"catalog"."enum_content_products_graphicFormat"[],
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shortLink" VARCHAR(80),
    "seoTitle" VARCHAR(160),
    "seoDescription" VARCHAR(240),
    "seoKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pricingType" "catalog"."enum_content_products_pricingType" NOT NULL,
    "price" DECIMAL(12,2),
    "status" "catalog"."enum_content_products_status" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(6),
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "downloadsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "fileSizeMB" INTEGER NOT NULL DEFAULT 0,
    "fileBytes" BIGINT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."product_assets" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "url" VARCHAR(255) NOT NULL,
    "alt" VARCHAR(255),
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."product_files" (
    "id" BIGSERIAL NOT NULL,
    "storageKey" VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255),
    "size" BIGINT,
    "mimeType" VARCHAR(255),
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."categories" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "parent_id" BIGINT,
    "coverUrl" VARCHAR(255),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."product_categories" (
    "product_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("product_id","category_id")
);

-- CreateTable
CREATE TABLE "catalog"."tags" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."product_tags" (
    "product_id" BIGINT NOT NULL,
    "tag_id" BIGINT NOT NULL,

    CONSTRAINT "product_tags_pkey" PRIMARY KEY ("product_id","tag_id")
);

-- CreateTable
CREATE TABLE "catalog"."product_suppliers" (
    "product_id" BIGINT NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("product_id","user_id")
);

-- CreateTable
CREATE TABLE "catalog"."topics" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "coverUrl" VARCHAR(255),
    "seoTitle" VARCHAR(160),
    "seoDescription" VARCHAR(240),

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."product_topics" (
    "product_id" BIGINT NOT NULL,
    "topic_id" BIGINT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_topics_pkey" PRIMARY KEY ("product_id","topic_id")
);

-- CreateTable
CREATE TABLE "catalog"."bookmarks" (
    "user_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("user_id","product_id")
);

-- CreateTable
CREATE TABLE "catalog"."likes" (
    "user_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("user_id","product_id")
);

-- CreateTable
CREATE TABLE "catalog"."comments" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "targetType" "catalog"."enum_content_comment_target" NOT NULL,
    "targetId" VARCHAR(64) NOT NULL,
    "product_id" BIGINT,
    "parent_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics"."product_views" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "user_id" UUID,
    "ip" VARCHAR(255),
    "ua" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics"."product_downloads" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "user_id" UUID NOT NULL,
    "bytes" BIGINT,
    "pricePaid" INTEGER,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "core"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "core"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "core"."users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "core"."users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "core"."users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshJti_key" ON "core"."sessions"("refreshJti");

-- CreateIndex
CREATE INDEX "session_user_active_idx" ON "core"."sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "session_expiry_idx" ON "core"."sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "core"."password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "pwd_reset_expiry_idx" ON "core"."password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_created_at_idx" ON "core"."audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_user_time_idx" ON "core"."audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "core"."roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "core"."user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "core"."wallets"("user_id");

-- CreateIndex
CREATE INDEX "IDX_wallet_transactions_created_at" ON "core"."wallet_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "IDX_wallet_transactions_status" ON "core"."wallet_transactions"("status");

-- CreateIndex
CREATE INDEX "IDX_wallet_transactions_group_id" ON "core"."wallet_transactions"("group_id");

-- CreateIndex
CREATE INDEX "IDX_wallet_transactions_user_id" ON "core"."wallet_transactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_wallet_tx_wallet_idempotency" ON "core"."wallet_transactions"("wallet_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "IDX_wallet_audit_user_created" ON "core"."wallet_audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "IDX_wallet_audit_wallet_created" ON "core"."wallet_audit_logs"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "File_userId_createdAt_idx" ON "core"."File"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "catalog"."products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_file_id_key" ON "catalog"."products"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_shortLink_key" ON "catalog"."products"("shortLink");

-- CreateIndex
CREATE INDEX "products_status_pricing_idx" ON "catalog"."products"("status", "pricingType");

-- CreateIndex
CREATE INDEX "products_created_at_idx" ON "catalog"."products"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "catalog"."categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_category_idx" ON "catalog"."product_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "catalog"."tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "catalog"."tags"("slug");

-- CreateIndex
CREATE INDEX "product_tags_tag_idx" ON "catalog"."product_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_name_key" ON "catalog"."topics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "catalog"."topics"("slug");

-- CreateIndex
CREATE INDEX "product_topics_topic_idx" ON "catalog"."product_topics"("topic_id");

-- CreateIndex
CREATE INDEX "bookmarks_user_time_idx" ON "catalog"."bookmarks"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "likes_product_idx" ON "catalog"."likes"("product_id");

-- CreateIndex
CREATE INDEX "likes_user_time_idx" ON "catalog"."likes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_target_time_idx" ON "catalog"."comments"("targetType", "targetId", "created_at");

-- CreateIndex
CREATE INDEX "comments_product_time_idx" ON "catalog"."comments"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "product_downloads_product_time_idx" ON "analytics"."product_downloads"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "product_downloads_user_time_idx" ON "analytics"."product_downloads"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "core"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "core"."wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallet_audit_logs" ADD CONSTRAINT "wallet_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallet_audit_logs" ADD CONSTRAINT "wallet_audit_logs_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "core"."wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "catalog"."product_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_assets" ADD CONSTRAINT "product_assets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_categories" ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_categories" ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_tags" ADD CONSTRAINT "product_tags_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_tags" ADD CONSTRAINT "product_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "catalog"."tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_suppliers" ADD CONSTRAINT "product_suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_topics" ADD CONSTRAINT "product_topics_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_topics" ADD CONSTRAINT "product_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "catalog"."topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."bookmarks" ADD CONSTRAINT "bookmarks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."likes" ADD CONSTRAINT "likes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."comments" ADD CONSTRAINT "comments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog"."comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."product_views" ADD CONSTRAINT "product_views_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."product_views" ADD CONSTRAINT "product_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."product_downloads" ADD CONSTRAINT "product_downloads_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."product_downloads" ADD CONSTRAINT "product_downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
