-- Drop legacy coupon tables before recreating enriched structures
DROP TABLE IF EXISTS "finance"."coupon_redemptions";
DROP TABLE IF EXISTS "finance"."coupons";

-- Create enum type for redemption status
CREATE TYPE "finance"."discount_redemption_status_enum" AS ENUM (
  'RESERVED',
  'COMMITTED',
  'RELEASED'
);

-- Create new discount coupon table
CREATE TABLE "finance"."discount_coupons" (
  "id" UUID NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "percent_off" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "max_redemptions" INTEGER,
  "per_user_max_redemptions" INTEGER,
  "starts_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  "created_by_admin_id" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discount_coupons_percent_off_check" CHECK ("percent_off" >= 1 AND "percent_off" <= 100),
  CONSTRAINT "discount_coupons_pkey" PRIMARY KEY ("id")
);

-- Create table for discount redemptions
CREATE TABLE "finance"."discount_redemptions" (
  "id" UUID NOT NULL,
  "coupon_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "order_id" UUID,
  "status" "finance"."discount_redemption_status_enum" NOT NULL DEFAULT 'COMMITTED',
  "reserved_at" TIMESTAMPTZ(6),
  "committed_at" TIMESTAMPTZ(6),
  "released_at" TIMESTAMPTZ(6),
  "metadata" JSONB,
  "discount_percent" INTEGER,
  "discount_amount" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discount_redemptions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "discount_coupons_code_key" ON "finance"."discount_coupons"("code");
CREATE INDEX "discount_coupons_code_is_active_idx" ON "finance"."discount_coupons"("code", "is_active");
CREATE INDEX "discount_redemptions_coupon_id_idx" ON "finance"."discount_redemptions"("coupon_id");
CREATE INDEX "discount_redemptions_coupon_id_user_id_idx" ON "finance"."discount_redemptions"("coupon_id", "user_id");
CREATE UNIQUE INDEX "discount_redemptions_coupon_id_order_id_key" ON "finance"."discount_redemptions"("coupon_id", "order_id");
CREATE INDEX "discount_redemptions_order_id_idx" ON "finance"."discount_redemptions"("order_id");

-- Foreign keys
ALTER TABLE "finance"."discount_redemptions" ADD CONSTRAINT "discount_redemptions_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "finance"."discount_coupons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."discount_redemptions" ADD CONSTRAINT "discount_redemptions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."discount_redemptions" ADD CONSTRAINT "discount_redemptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "core"."users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."discount_coupons" ADD CONSTRAINT "discount_coupons_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."orders" ADD COLUMN "discount_metadata" JSONB;
ALTER TABLE "finance"."orders" ADD COLUMN "request_id" VARCHAR(255);

CREATE UNIQUE INDEX "orders_user_id_request_id_key" ON "finance"."orders"("user_id", "request_id");

CREATE TABLE "finance"."checkout_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "request_id" VARCHAR(255) NOT NULL,
  "order_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "response" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checkout_sessions_user_request_id_key" ON "finance"."checkout_sessions"("user_id", "request_id");
CREATE INDEX "checkout_sessions_order_id_idx" ON "finance"."checkout_sessions"("order_id");
CREATE INDEX "checkout_sessions_payment_id_idx" ON "finance"."checkout_sessions"("payment_id");

ALTER TABLE "finance"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "core"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "finance"."orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "finance"."payments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
