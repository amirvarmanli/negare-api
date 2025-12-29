/*
  Warnings:

  - A unique constraint covering the columns `[user_id,product_id,order_id]` on the table `entitlements` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[order_id,product_id,beneficiary_type,supplier_id]` on the table `order_revenue_splits` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "finance"."finance_discount_value_type_enum" AS ENUM ('FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "finance"."finance_payout_status_enum" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "finance"."finance_cart_status_enum" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');

-- AlterEnum
ALTER TYPE "finance"."finance_order_status_enum" ADD VALUE 'EXPIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "finance"."finance_revenue_pool_status_enum" ADD VALUE 'OPEN';
ALTER TYPE "finance"."finance_revenue_pool_status_enum" ADD VALUE 'FINALIZED';

-- AlterTable
ALTER TABLE "finance"."order_revenue_splits" ADD COLUMN     "payout_id" UUID;

-- AlterTable
ALTER TABLE "finance"."subscription_supplier_earnings" ADD COLUMN     "payout_id" UUID;

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

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_key" ON "finance"."carts"("user_id");

-- CreateIndex
CREATE INDEX "carts_user_id_idx" ON "finance"."carts"("user_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_product_id_idx" ON "finance"."cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_key" ON "finance"."cart_items"("cart_id", "product_id");

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
CREATE INDEX "supplier_payouts_supplier_id_status_idx" ON "finance"."supplier_payouts"("supplier_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_user_id_product_id_order_id_key" ON "finance"."entitlements"("user_id", "product_id", "order_id");

-- CreateIndex
CREATE INDEX "order_revenue_splits_supplier_id_idx" ON "finance"."order_revenue_splits"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_revenue_splits_order_id_product_id_beneficiary_type_s_key" ON "finance"."order_revenue_splits"("order_id", "product_id", "beneficiary_type", "supplier_id");

-- AddForeignKey
ALTER TABLE "finance"."carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "finance"."carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "finance"."subscription_supplier_earnings" ADD CONSTRAINT "subscription_supplier_earnings_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "finance"."supplier_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."supplier_payouts" ADD CONSTRAINT "supplier_payouts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."order_revenue_splits" ADD CONSTRAINT "order_revenue_splits_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "finance"."supplier_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
