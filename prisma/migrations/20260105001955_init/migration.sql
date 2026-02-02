-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "analytics";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalog";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finance";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "catalog"."BlogSectionMediaType" AS ENUM ('image', 'video');

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
CREATE TYPE "core"."notification_type_enum" AS ENUM ('ADMIN_BROADCAST', 'FOLLOWED_YOU', 'PURCHASED_YOUR_PRODUCT', 'WALLET_CREDITED', 'NEW_PRODUCT_FROM_FOLLOWED');

-- CreateEnum
CREATE TYPE "core"."notification_status_enum" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "core"."notification_target_group_enum" AS ENUM ('ALL_USERS', 'SUPPLIERS_ONLY', 'USERS_ONLY');

-- CreateEnum
CREATE TYPE "core"."AuditAction" AS ENUM ('OTP_REQUEST', 'OTP_VERIFY_SUCCESS', 'OTP_VERIFY_FAIL', 'LOGIN_SUCCESS', 'LOGIN_FAIL', 'REFRESH_ROTATE', 'REFRESH_REUSE_DETECTED', 'LOGOUT', 'LOGOUT_ALL', 'PASSWORD_SET', 'PASSWORD_FORGOT_REQUEST', 'PASSWORD_RESET_SUCCESS', 'PASSWORD_RESET_FAIL');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_products_pricingType" AS ENUM ('FREE', 'PAID', 'PAID_OR_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_products_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_publication_status" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_comment_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_products_graphicFormat" AS ENUM ('PSD', 'EPS', 'JPG', 'PNG', 'PDF', 'MP4', 'AI', 'CDR', 'TTF', 'TIF', 'SVG', 'OBJ', 'WEBP');

-- CreateEnum
CREATE TYPE "catalog"."enum_content_comment_target" AS ENUM ('PRODUCT', 'POST', 'NEWSLETTER');

-- CreateEnum
CREATE TYPE "finance"."finance_order_status_enum" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'CANCELLED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "finance"."finance_order_kind_enum" AS ENUM ('PRODUCT', 'SUBSCRIPTION', 'TOPUP');

-- CreateEnum
CREATE TYPE "finance"."finance_discount_type_enum" AS ENUM ('NONE', 'FIXED', 'PERCENT', 'COUPON');

-- CreateEnum
CREATE TYPE "finance"."finance_discount_value_type_enum" AS ENUM ('FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "finance"."finance_payment_provider_enum" AS ENUM ('MOCK', 'ZIBAL');

-- CreateEnum
CREATE TYPE "finance"."finance_payment_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "finance"."finance_payment_purpose_enum" AS ENUM ('ORDER', 'WALLET_TOPUP', 'DONATION');

-- CreateEnum
CREATE TYPE "finance"."finance_payment_reference_type_enum" AS ENUM ('cart', 'subscription', 'wallet_charge', 'donation');

-- CreateEnum
CREATE TYPE "finance"."finance_donation_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."order_request_messenger_enum" AS ENUM ('telegram', 'eitaa', 'ble');

-- CreateEnum
CREATE TYPE "public"."order_request_file_kind_enum" AS ENUM ('IMAGE', 'ZIP');

-- CreateEnum
CREATE TYPE "public"."order_request_payment_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."order_request_payment_purpose_enum" AS ENUM ('PHOTO_RESTORE');

-- CreateEnum
CREATE TYPE "finance"."finance_wallet_transaction_type_enum" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "finance"."finance_wallet_transaction_reason_enum" AS ENUM ('TOPUP', 'ORDER_PAYMENT', 'REFUND', 'ADJUSTMENT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "finance"."finance_wallet_transaction_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "finance"."finance_wallet_status_enum" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "finance"."finance_entitlement_source_enum" AS ENUM ('PURCHASED', 'SUB_QUOTA', 'FREE_QUOTA');

-- CreateEnum
CREATE TYPE "finance"."finance_subscription_plan_code_enum" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "finance"."finance_subscription_status_enum" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "finance"."finance_subscription_purchase_status_enum" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "finance"."finance_revenue_pool_status_enum" AS ENUM ('DRAFT', 'COMPUTED', 'OPEN', 'FINALIZED');

-- CreateEnum
CREATE TYPE "finance"."finance_payout_status_enum" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "finance"."finance_earning_status_enum" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "finance"."finance_revenue_beneficiary_type_enum" AS ENUM ('PLATFORM', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "finance"."finance_cart_status_enum" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');

-- CreateTable
CREATE TABLE "core"."users" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "username" CITEXT,
    "email" CITEXT,
    "phone" VARCHAR(32),
    "name" VARCHAR(255),
    "firstName" VARCHAR(120),
    "lastName" VARCHAR(120),
    "bio" TEXT,
    "city" VARCHAR(255),
    "cityId" UUID,
    "avatarUrl" VARCHAR(255),
    "passwordHash" VARCHAR(255),
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "core"."UserStatus" NOT NULL DEFAULT 'active',
    "passwordChangedAt" TIMESTAMPTZ(6),
    "lastLoginAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "role" "core"."role_name_enum" NOT NULL DEFAULT 'user',

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
CREATE TABLE "core"."cities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "province" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."permissions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "group" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."user_permissions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."notifications" (
    "id" UUID NOT NULL,
    "type" "core"."notification_type_enum" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" VARCHAR(500),
    "entityType" VARCHAR(50),
    "entitySlug" VARCHAR(255),
    "entityId" VARCHAR(255),
    "href" VARCHAR(500),
    "data" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."user_notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "status" "core"."notification_status_enum" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMPTZ(6),
    "dedupeKey" VARCHAR(200),

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "core"."skills" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "nameFa" VARCHAR(255) NOT NULL,
    "nameEn" VARCHAR(255),
    "description" VARCHAR(1000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."user_skills" (
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("user_id","skill_id")
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
    "slug" VARCHAR(200) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" VARCHAR(1400),
    "coverUrl" VARCHAR(255),
    "graphicFormats" "catalog"."enum_content_products_graphicFormat"[] DEFAULT ARRAY[]::"catalog"."enum_content_products_graphicFormat"[],
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shortLink" VARCHAR(80),
    "seoTitle" VARCHAR(250),
    "seoDescription" VARCHAR(1400),
    "seoKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "search_text_normalized" TEXT,
    "pricingType" "catalog"."enum_content_products_pricingType" NOT NULL,
    "price" DECIMAL(12,2),
    "status" "catalog"."enum_content_products_status" NOT NULL DEFAULT 'DRAFT',
    "pinnedAt" TIMESTAMPTZ(6),
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
    "product_id" BIGINT NOT NULL,
    "file_id" TEXT,
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
    "slug" VARCHAR(200) NOT NULL,
    "parent_id" BIGINT,
    "coverUrl" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

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
    "slug" VARCHAR(200) NOT NULL,
    "coverUrl" VARCHAR(255),
    "seoTitle" VARCHAR(160),
    "seoDescription" VARCHAR(550),

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
CREATE TABLE "catalog"."slug_redirects" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(32) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "fromSlug" VARCHAR(200) NOT NULL,
    "toSlug" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_redirects_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "catalog"."artist_follows" (
    "follower_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artist_follows_pkey" PRIMARY KEY ("follower_id","artist_id")
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
    "browser_title" VARCHAR(70),
    "excerpt" VARCHAR(600),
    "content" TEXT NOT NULL,
    "cover_image_url" VARCHAR(1024),
    "preview_cover_url" VARCHAR(1024),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_at" TIMESTAMPTZ(6),
    "pinned_by_admin_id" UUID,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "status" "catalog"."enum_content_publication_status" NOT NULL DEFAULT 'DRAFT',
    "reviewed_by_admin_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "reject_reason" VARCHAR(500),
    "archived_at" TIMESTAMPTZ(6),
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
    "browser_title" VARCHAR(70),
    "excerpt" VARCHAR(600),
    "content" TEXT NOT NULL,
    "cover_image_url" VARCHAR(1024),
    "file_url" VARCHAR(1024),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_at" TIMESTAMPTZ(6),
    "pinned_by_admin_id" UUID,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "status" "catalog"."enum_content_publication_status" NOT NULL DEFAULT 'DRAFT',
    "reviewed_by_admin_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "reject_reason" VARCHAR(500),
    "archived_at" TIMESTAMPTZ(6),
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

-- CreateTable
CREATE TABLE "finance"."product_contributors" (
    "id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_count" INTEGER NOT NULL,
    "share_percent" INTEGER,

    CONSTRAINT "product_contributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."carts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "finance"."finance_cart_status_enum" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "finance"."finance_order_status_enum" NOT NULL,
    "order_kind" "finance"."finance_order_kind_enum" NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discount_type" "finance"."finance_discount_type_enum" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "subscription_plan_id" UUID,
    "subscription_duration_months" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."product_discounts" (
    "id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "type" "finance"."finance_discount_value_type_enum" NOT NULL,
    "value" INTEGER NOT NULL,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."user_discounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "finance"."finance_discount_value_type_enum" NOT NULL,
    "value" INTEGER NOT NULL,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."coupons" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "type" "finance"."finance_discount_value_type_enum" NOT NULL,
    "value" INTEGER NOT NULL,
    "max_usage" INTEGER,
    "max_usage_per_user" INTEGER,
    "expires_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."coupon_redemptions" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "unit_price_snapshot" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" INTEGER NOT NULL,
    "product_type_snapshot" "catalog"."enum_content_products_pricingType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."payments" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "user_id" UUID NOT NULL,
    "purpose" "finance"."finance_payment_purpose_enum" NOT NULL DEFAULT 'ORDER',
    "reference_type" "finance"."finance_payment_reference_type_enum",
    "reference_id" VARCHAR(128),
    "provider" "finance"."finance_payment_provider_enum" NOT NULL,
    "status" "finance"."finance_payment_status_enum" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "track_id" VARCHAR(128),
    "authority" VARCHAR(128),
    "ref_id" VARCHAR(128),
    "failure_reason" VARCHAR(512),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "meta" JSONB,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'TOMAN',
    "status" "finance"."finance_wallet_status_enum" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."wallet_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "finance"."finance_wallet_transaction_type_enum" NOT NULL,
    "reason" "finance"."finance_wallet_transaction_reason_enum" NOT NULL,
    "status" "finance"."finance_wallet_transaction_status_enum" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER,
    "reference_id" VARCHAR(128),
    "description" VARCHAR(1000),
    "idempotency_key" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."entitlements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "source" "finance"."finance_entitlement_source_enum" NOT NULL,
    "order_id" UUID,
    "purchased_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."download_usage_daily" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date_key" VARCHAR(10) NOT NULL,
    "used_free" INTEGER NOT NULL DEFAULT 0,
    "used_sub" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "download_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."download_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "date_time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_key" VARCHAR(10) NOT NULL,
    "source" "finance"."finance_entitlement_source_enum" NOT NULL,
    "subscription_id" UUID,
    "order_id" UUID,

    CONSTRAINT "download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_plans" (
    "id" UUID NOT NULL,
    "code" "finance"."finance_subscription_plan_code_enum" NOT NULL,
    "daily_sub_limit" INTEGER NOT NULL,
    "daily_free_limit" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."donations" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "amount" INTEGER NOT NULL,
    "status" "finance"."finance_donation_status_enum" NOT NULL,
    "gateway_track_id" VARCHAR(128),
    "reference_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."user_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "finance"."finance_subscription_status_enum" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_purchases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "finance"."finance_subscription_purchase_status_enum" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "duration_months" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(6),
    "payment_id" UUID,

    CONSTRAINT "subscription_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_plans_v2" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "price" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "daily_subscription_download_limit" INTEGER NOT NULL,
    "daily_free_download_limit_with_subscription" INTEGER NOT NULL,
    "description" VARCHAR(2000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "discount_percent" INTEGER,
    "discount_quota" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_plans_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."user_subscriptions_v2" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "plan_title" VARCHAR(255) NOT NULL,
    "price" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "daily_subscription_download_limit" INTEGER NOT NULL,
    "daily_free_download_limit_with_subscription" INTEGER NOT NULL,
    "discount_percent" INTEGER,
    "discount_remaining" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "finance"."finance_subscription_status_enum" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_subscriptions_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_download_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "download_type" VARCHAR(20) NOT NULL,
    "subscription_id" UUID,
    "date_key" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_discount_usages" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "subscription_discount_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_settlements" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "price" INTEGER NOT NULL,
    "total_downloads" INTEGER NOT NULL,
    "platform_amount" INTEGER NOT NULL,
    "supplier_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_settlement_suppliers" (
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "download_count" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_settlement_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_revenue_pools" (
    "id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_revenue" INTEGER NOT NULL,
    "platform_share_amount" INTEGER NOT NULL,
    "distributable_amount" INTEGER NOT NULL,
    "status" "finance"."finance_revenue_pool_status_enum" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_revenue_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."subscription_supplier_earnings" (
    "id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "downloads_credit" DECIMAL(10,2) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "finance"."finance_earning_status_enum" NOT NULL,
    "payout_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_supplier_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."supplier_payouts" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "status" "finance"."finance_payout_status_enum" NOT NULL,
    "reference" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."order_revenue_splits" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "beneficiary_type" "finance"."finance_revenue_beneficiary_type_enum" NOT NULL,
    "supplier_id" UUID,
    "amount" INTEGER NOT NULL,
    "payout_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_revenue_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_requests" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "messenger" "public"."order_request_messenger_enum" NOT NULL,
    "phone_number" VARCHAR(32) NOT NULL,
    "description" VARCHAR(2000),
    "image_count" INTEGER NOT NULL,
    "amount_toman" INTEGER NOT NULL,
    "file_url" VARCHAR(1000) NOT NULL,
    "file_source" VARCHAR(64),
    "file_kind" "public"."order_request_file_kind_enum",
    "original_file_name" VARCHAR(255),
    "file_mime_type" VARCHAR(128),
    "file_size" INTEGER,
    "storage_key" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_request_payments" (
    "id" UUID NOT NULL,
    "order_request_id" UUID,
    "gateway" VARCHAR(32) NOT NULL,
    "purpose" "public"."order_request_payment_purpose_enum" NOT NULL DEFAULT 'PHOTO_RESTORE',
    "amount_toman" INTEGER NOT NULL,
    "status" "public"."order_request_payment_status_enum" NOT NULL DEFAULT 'PENDING',
    "track_id" VARCHAR(64),
    "transaction_id" VARCHAR(128),
    "redirect_url" VARCHAR(512),
    "result" INTEGER,
    "message" VARCHAR(512),
    "order_draft" JSONB,
    "raw_request" JSONB,
    "raw_verify" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_request_payments_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "cities_name_idx" ON "core"."cities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "core"."permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permissionId_key" ON "core"."user_permissions"("userId", "permissionId");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "core"."notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "core"."notifications"("createdAt");

-- CreateIndex
CREATE INDEX "user_notifications_user_status_created_idx" ON "core"."user_notifications"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "user_notifications_user_created_idx" ON "core"."user_notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_userId_dedupeKey_key" ON "core"."user_notifications"("userId", "dedupeKey");

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
CREATE UNIQUE INDEX "skills_key_key" ON "core"."skills"("key");

-- CreateIndex
CREATE INDEX "user_skills_skill_idx" ON "core"."user_skills"("skill_id");

-- CreateIndex
CREATE INDEX "File_userId_createdAt_idx" ON "core"."File"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "catalog"."products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_shortLink_key" ON "catalog"."products"("shortLink");

-- CreateIndex
CREATE INDEX "products_status_pricing_idx" ON "catalog"."products"("status", "pricingType");

-- CreateIndex
CREATE INDEX "products_pinned_at_created_at_idx" ON "catalog"."products"("pinnedAt", "createdAt");

-- CreateIndex
CREATE INDEX "products_created_at_idx" ON "catalog"."products"("createdAt");

-- CreateIndex
CREATE INDEX "products_updated_at_idx" ON "catalog"."products"("updatedAt");

-- CreateIndex
CREATE INDEX "products_price_idx" ON "catalog"."products"("price");

-- CreateIndex
CREATE INDEX "products_title_idx" ON "catalog"."products"("title");

-- CreateIndex
CREATE UNIQUE INDEX "product_files_product_id_key" ON "catalog"."product_files"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "catalog"."categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_idx" ON "catalog"."categories"("parent_id");

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
CREATE UNIQUE INDEX "slug_redirects_fromSlug_key" ON "catalog"."slug_redirects"("fromSlug");

-- CreateIndex
CREATE INDEX "slug_redirect_entity_idx" ON "catalog"."slug_redirects"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "bookmarks_user_time_idx" ON "catalog"."bookmarks"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "likes_product_idx" ON "catalog"."likes"("product_id");

-- CreateIndex
CREATE INDEX "likes_user_time_idx" ON "catalog"."likes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "artist_follows_artist_time_idx" ON "catalog"."artist_follows"("artist_id", "created_at");

-- CreateIndex
CREATE INDEX "artist_follows_follower_time_idx" ON "catalog"."artist_follows"("follower_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_target_time_idx" ON "catalog"."comments"("targetType", "targetId", "created_at");

-- CreateIndex
CREATE INDEX "comments_product_time_idx" ON "catalog"."comments"("product_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "catalog"."blog_categories"("slug");

-- CreateIndex
CREATE INDEX "blog_categories_active_idx" ON "catalog"."blog_categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "catalog"."blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_pub_idx" ON "catalog"."blog_posts"("status", "published_at");

-- CreateIndex
CREATE INDEX "blog_posts_status_idx" ON "catalog"."blog_posts"("status");

-- CreateIndex
CREATE INDEX "blog_posts_category_idx" ON "catalog"."blog_posts"("category_id");

-- CreateIndex
CREATE INDEX "blog_posts_author_idx" ON "catalog"."blog_posts"("author_id");

-- CreateIndex
CREATE INDEX "blog_posts_created_at_idx" ON "catalog"."blog_posts"("created_at");

-- CreateIndex
CREATE INDEX "blog_comments_post_status_idx" ON "catalog"."blog_comments"("post_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "blog_post_sections_post_order_idx" ON "catalog"."blog_post_sections"("blog_post_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_categories_slug_key" ON "catalog"."newsletter_categories"("slug");

-- CreateIndex
CREATE INDEX "newsletter_categories_active_idx" ON "catalog"."newsletter_categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_issues_slug_key" ON "catalog"."newsletter_issues"("slug");

-- CreateIndex
CREATE INDEX "newsletter_issue_status_pub_idx" ON "catalog"."newsletter_issues"("status", "published_at");

-- CreateIndex
CREATE INDEX "newsletter_issues_status_idx" ON "catalog"."newsletter_issues"("status");

-- CreateIndex
CREATE INDEX "newsletter_issue_category_idx" ON "catalog"."newsletter_issues"("category_id");

-- CreateIndex
CREATE INDEX "newsletter_issues_author_idx" ON "catalog"."newsletter_issues"("author_id");

-- CreateIndex
CREATE INDEX "newsletter_issues_created_at_idx" ON "catalog"."newsletter_issues"("created_at");

-- CreateIndex
CREATE INDEX "newsletter_comments_issue_status_idx" ON "catalog"."newsletter_comments"("issue_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "newsletter_sections_issue_order_idx" ON "catalog"."newsletter_sections"("issue_id", "order");

-- CreateIndex
CREATE INDEX "product_downloads_product_time_idx" ON "analytics"."product_downloads"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "product_downloads_user_time_idx" ON "analytics"."product_downloads"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_contributors_product_id_supplier_id_key" ON "finance"."product_contributors"("product_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_key" ON "finance"."carts"("user_id");

-- CreateIndex
CREATE INDEX "carts_user_id_idx" ON "finance"."carts"("user_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_product_id_idx" ON "finance"."cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_key" ON "finance"."cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "finance"."orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "product_discounts_product_id_is_active_idx" ON "finance"."product_discounts"("product_id", "is_active");

-- CreateIndex
CREATE INDEX "user_discounts_user_id_is_active_idx" ON "finance"."user_discounts"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "finance"."coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_code_is_active_idx" ON "finance"."coupons"("code", "is_active");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_user_id_idx" ON "finance"."coupon_redemptions"("coupon_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_coupon_id_order_id_key" ON "finance"."coupon_redemptions"("coupon_id", "order_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "finance"."order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "finance"."order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_track_id_key" ON "finance"."payments"("track_id");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "finance"."payments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "finance"."payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "finance"."payments"("status");

-- CreateIndex
CREATE INDEX "payments_reference_idx" ON "finance"."payments"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "finance"."wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "finance"."wallet_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "finance"."wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_id_idx" ON "finance"."wallet_transactions"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_finance_wallet_tx_idempotency" ON "finance"."wallet_transactions"("wallet_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "entitlements_user_purchased_idx" ON "finance"."entitlements"("user_id", "purchased_at");

-- CreateIndex
CREATE INDEX "entitlements_order_idx" ON "finance"."entitlements"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_user_id_product_id_key" ON "finance"."entitlements"("user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "download_usage_daily_user_id_date_key_key" ON "finance"."download_usage_daily"("user_id", "date_key");

-- CreateIndex
CREATE INDEX "download_logs_user_id_date_key_idx" ON "finance"."download_logs"("user_id", "date_key");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "finance"."subscription_plans"("code");

-- CreateIndex
CREATE INDEX "donations_user_id_created_at_idx" ON "finance"."donations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_subscriptions_user_id_end_at_idx" ON "finance"."user_subscriptions"("user_id", "end_at");

-- CreateIndex
CREATE INDEX "subscription_purchases_user_id_created_at_idx" ON "finance"."subscription_purchases"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_purchases_plan_id_idx" ON "finance"."subscription_purchases"("plan_id");

-- CreateIndex
CREATE INDEX "subscription_purchases_payment_id_idx" ON "finance"."subscription_purchases"("payment_id");

-- CreateIndex
CREATE INDEX "subscription_plans_v2_is_active_idx" ON "finance"."subscription_plans_v2"("is_active");

-- CreateIndex
CREATE INDEX "user_subscriptions_v2_user_id_status_idx" ON "finance"."user_subscriptions_v2"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_subscriptions_v2_end_at_status_idx" ON "finance"."user_subscriptions_v2"("end_at", "status");

-- CreateIndex
CREATE INDEX "subscription_download_logs_user_id_date_key_download_type_idx" ON "finance"."subscription_download_logs"("user_id", "date_key", "download_type");

-- CreateIndex
CREATE INDEX "subscription_download_logs_subscription_id_created_at_idx" ON "finance"."subscription_download_logs"("subscription_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_download_logs_supplier_id_created_at_idx" ON "finance"."subscription_download_logs"("supplier_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_discount_usages_subscription_id_idx" ON "finance"."subscription_discount_usages"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_discount_usages_order_id_key" ON "finance"."subscription_discount_usages"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_settlements_subscription_id_key" ON "finance"."subscription_settlements"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_settlements_user_id_created_at_idx" ON "finance"."subscription_settlements"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_settlement_suppliers_supplier_id_idx" ON "finance"."subscription_settlement_suppliers"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_settlement_suppliers_settlement_id_supplier_id_key" ON "finance"."subscription_settlement_suppliers"("settlement_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_revenue_pools_period_start_period_end_key" ON "finance"."subscription_revenue_pools"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "subscription_supplier_earnings_supplier_id_idx" ON "finance"."subscription_supplier_earnings"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_payouts_supplier_id_status_idx" ON "finance"."supplier_payouts"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "order_revenue_splits_order_id_idx" ON "finance"."order_revenue_splits"("order_id");

-- CreateIndex
CREATE INDEX "order_revenue_splits_supplier_id_idx" ON "finance"."order_revenue_splits"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_revenue_splits_order_id_product_id_beneficiary_type_s_key" ON "finance"."order_revenue_splits"("order_id", "product_id", "beneficiary_type", "supplier_id");

-- CreateIndex
CREATE INDEX "order_requests_created_at_idx" ON "public"."order_requests"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_request_payments_order_request_id_key" ON "public"."order_request_payments"("order_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_request_payments_track_id_key" ON "public"."order_request_payments"("track_id");

-- CreateIndex
CREATE INDEX "order_request_payments_track_idx" ON "public"."order_request_payments"("track_id");

-- AddForeignKey
ALTER TABLE "core"."users" ADD CONSTRAINT "users_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "core"."cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_permissions" ADD CONSTRAINT "user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "core"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."notifications" ADD CONSTRAINT "notifications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_notifications" ADD CONSTRAINT "user_notifications_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "core"."notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "core"."wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallet_audit_logs" ADD CONSTRAINT "wallet_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."wallet_audit_logs" ADD CONSTRAINT "wallet_audit_logs_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "core"."wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_skills" ADD CONSTRAINT "user_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "core"."skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_assets" ADD CONSTRAINT "product_assets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_files" ADD CONSTRAINT "product_files_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_files" ADD CONSTRAINT "product_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "core"."File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_categories" ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_categories" ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "catalog"."bookmarks" ADD CONSTRAINT "bookmarks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."likes" ADD CONSTRAINT "likes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."artist_follows" ADD CONSTRAINT "artist_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."artist_follows" ADD CONSTRAINT "artist_follows_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog"."comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."comments" ADD CONSTRAINT "comments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "catalog"."blog_post_sections" ADD CONSTRAINT "blog_post_sections_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "catalog"."blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "catalog"."newsletter_sections" ADD CONSTRAINT "newsletter_sections_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "catalog"."newsletter_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."product_views" ADD CONSTRAINT "product_views_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."product_views" ADD CONSTRAINT "product_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."product_downloads" ADD CONSTRAINT "product_downloads_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics"."product_downloads" ADD CONSTRAINT "product_downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."product_contributors" ADD CONSTRAINT "product_contributors_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."product_contributors" ADD CONSTRAINT "product_contributors_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "finance"."carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."product_discounts" ADD CONSTRAINT "product_discounts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."user_discounts" ADD CONSTRAINT "user_discounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "finance"."coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "finance"."wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."entitlements" ADD CONSTRAINT "entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."entitlements" ADD CONSTRAINT "entitlements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."download_usage_daily" ADD CONSTRAINT "download_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."download_logs" ADD CONSTRAINT "download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."download_logs" ADD CONSTRAINT "download_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "finance"."subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_purchases" ADD CONSTRAINT "subscription_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_purchases" ADD CONSTRAINT "subscription_purchases_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "finance"."subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_purchases" ADD CONSTRAINT "subscription_purchases_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "finance"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."user_subscriptions_v2" ADD CONSTRAINT "user_subscriptions_v2_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "finance"."subscription_plans_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."user_subscriptions_v2" ADD CONSTRAINT "user_subscriptions_v2_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_download_logs" ADD CONSTRAINT "subscription_download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_download_logs" ADD CONSTRAINT "subscription_download_logs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_download_logs" ADD CONSTRAINT "subscription_download_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_download_logs" ADD CONSTRAINT "subscription_download_logs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "finance"."user_subscriptions_v2"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_discount_usages" ADD CONSTRAINT "subscription_discount_usages_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "finance"."user_subscriptions_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_discount_usages" ADD CONSTRAINT "subscription_discount_usages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_discount_usages" ADD CONSTRAINT "subscription_discount_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_settlements" ADD CONSTRAINT "subscription_settlements_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "finance"."user_subscriptions_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_settlements" ADD CONSTRAINT "subscription_settlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "finance"."subscription_plans_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_settlements" ADD CONSTRAINT "subscription_settlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_settlement_suppliers" ADD CONSTRAINT "subscription_settlement_suppliers_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "finance"."subscription_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_settlement_suppliers" ADD CONSTRAINT "subscription_settlement_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_supplier_earnings" ADD CONSTRAINT "subscription_supplier_earnings_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "finance"."subscription_revenue_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_supplier_earnings" ADD CONSTRAINT "subscription_supplier_earnings_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_supplier_earnings" ADD CONSTRAINT "subscription_supplier_earnings_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "finance"."supplier_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."supplier_payouts" ADD CONSTRAINT "supplier_payouts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."order_revenue_splits" ADD CONSTRAINT "order_revenue_splits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."order_revenue_splits" ADD CONSTRAINT "order_revenue_splits_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."order_revenue_splits" ADD CONSTRAINT "order_revenue_splits_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "finance"."supplier_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_request_payments" ADD CONSTRAINT "order_request_payments_order_request_id_fkey" FOREIGN KEY ("order_request_id") REFERENCES "public"."order_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
