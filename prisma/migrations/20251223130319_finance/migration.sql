/*
  Warnings:

  - The values [SUBSCRIPTION] on the enum `enum_content_products_pricingType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finance";

-- CreateEnum
CREATE TYPE "finance"."finance_order_status_enum" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "finance"."finance_order_kind_enum" AS ENUM ('PRODUCT', 'SUBSCRIPTION', 'TOPUP');

-- CreateEnum
CREATE TYPE "finance"."finance_discount_type_enum" AS ENUM ('NONE', 'FIXED', 'PERCENT', 'COUPON');

-- CreateEnum
CREATE TYPE "finance"."finance_payment_provider_enum" AS ENUM ('MOCK');

-- CreateEnum
CREATE TYPE "finance"."finance_payment_status_enum" AS ENUM ('INITIATED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "finance"."finance_wallet_transaction_type_enum" AS ENUM ('TOPUP', 'PURCHASE', 'REFUND', 'ADJUST');

-- CreateEnum
CREATE TYPE "finance"."finance_wallet_reference_type_enum" AS ENUM ('ORDER', 'PAYMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "finance"."finance_entitlement_source_enum" AS ENUM ('PURCHASED', 'SUB_QUOTA', 'FREE_QUOTA');

-- CreateEnum
CREATE TYPE "finance"."finance_subscription_plan_code_enum" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "finance"."finance_subscription_status_enum" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "finance"."finance_revenue_pool_status_enum" AS ENUM ('DRAFT', 'COMPUTED');

-- CreateEnum
CREATE TYPE "finance"."finance_earning_status_enum" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "finance"."finance_revenue_beneficiary_type_enum" AS ENUM ('PLATFORM', 'SUPPLIER');

-- AlterEnum
BEGIN;
CREATE TYPE "catalog"."enum_content_products_pricingType_new" AS ENUM ('FREE', 'PAID', 'PAID_OR_SUBSCRIPTION');
ALTER TABLE "catalog"."products" ALTER COLUMN "pricingType" TYPE "catalog"."enum_content_products_pricingType_new" USING ("pricingType"::text::"catalog"."enum_content_products_pricingType_new");
ALTER TYPE "catalog"."enum_content_products_pricingType" RENAME TO "enum_content_products_pricingType_old";
ALTER TYPE "catalog"."enum_content_products_pricingType_new" RENAME TO "enum_content_products_pricingType";
DROP TYPE "catalog"."enum_content_products_pricingType_old";
COMMIT;

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

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
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
    "provider" "finance"."finance_payment_provider_enum" NOT NULL,
    "status" "finance"."finance_payment_status_enum" NOT NULL,
    "amount" INTEGER NOT NULL,
    "authority" VARCHAR(128),
    "ref_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ(6),
    "meta" JSONB,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."wallet_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "finance"."finance_wallet_transaction_type_enum" NOT NULL,
    "amount_signed" INTEGER NOT NULL,
    "reference_type" "finance"."finance_wallet_reference_type_enum" NOT NULL,
    "reference_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."entitlements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "source" "finance"."finance_entitlement_source_enum" NOT NULL,
    "order_id" UUID,
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
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_supplier_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."order_revenue_splits" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" BIGINT NOT NULL,
    "beneficiary_type" "finance"."finance_revenue_beneficiary_type_enum" NOT NULL,
    "supplier_id" UUID,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_revenue_splits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_contributors_product_id_supplier_id_key" ON "finance"."product_contributors"("product_id", "supplier_id");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "finance"."orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "finance"."order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "finance"."order_items"("product_id");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "finance"."payments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "finance"."wallet_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "entitlements_user_id_product_id_idx" ON "finance"."entitlements"("user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "download_usage_daily_user_id_date_key_key" ON "finance"."download_usage_daily"("user_id", "date_key");

-- CreateIndex
CREATE INDEX "download_logs_user_id_date_key_idx" ON "finance"."download_logs"("user_id", "date_key");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "finance"."subscription_plans"("code");

-- CreateIndex
CREATE INDEX "user_subscriptions_user_id_end_at_idx" ON "finance"."user_subscriptions"("user_id", "end_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_revenue_pools_period_start_period_end_key" ON "finance"."subscription_revenue_pools"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "subscription_supplier_earnings_supplier_id_idx" ON "finance"."subscription_supplier_earnings"("supplier_id");

-- CreateIndex
CREATE INDEX "order_revenue_splits_order_id_idx" ON "finance"."order_revenue_splits"("order_id");

-- AddForeignKey
ALTER TABLE "finance"."product_contributors" ADD CONSTRAINT "product_contributors_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."product_contributors" ADD CONSTRAINT "product_contributors_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "finance"."user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "finance"."subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_supplier_earnings" ADD CONSTRAINT "subscription_supplier_earnings_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "finance"."subscription_revenue_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."subscription_supplier_earnings" ADD CONSTRAINT "subscription_supplier_earnings_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."order_revenue_splits" ADD CONSTRAINT "order_revenue_splits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."order_revenue_splits" ADD CONSTRAINT "order_revenue_splits_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
