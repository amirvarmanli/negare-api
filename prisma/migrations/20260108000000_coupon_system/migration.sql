-- Drop the legacy discount tables before introducing the new coupon model
DROP TABLE IF EXISTS "finance"."discount_redemptions" CASCADE;
DROP TABLE IF EXISTS "finance"."discount_coupons" CASCADE;
DROP TYPE IF EXISTS "finance"."discount_redemption_status_enum";

-- Create enum backing the coupon value type (percent or fixed amount)
CREATE TYPE "finance"."coupon_value_type_enum" AS ENUM (
  'PERCENT',
  'AMOUNT'
);

-- Create the new DiscountCoupon table
CREATE TABLE "finance"."discount_coupons" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" VARCHAR(255) NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "value_type" "finance"."coupon_value_type_enum" NOT NULL,
  "value" INTEGER NOT NULL,
  "max_usage" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "expires_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discount_coupons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discount_coupons_code_key" UNIQUE ("code"),
  CONSTRAINT "discount_coupons_percent_value_check"
    CHECK (
      "value_type" <> 'PERCENT' OR ("value" >= 1 AND "value" <= 100)
    ),
  CONSTRAINT "discount_coupons_amount_value_check"
    CHECK (
      "value_type" <> 'AMOUNT' OR "value" >= 1
    ),
  CONSTRAINT "discount_coupons_max_usage_positive"
    CHECK ("max_usage" IS NULL OR "max_usage" > 0)
);

-- Index the code and active flag to speed lookups
CREATE INDEX "discount_coupons_code_is_active_idx" ON "finance"."discount_coupons" ("code", "is_active");

-- Create the redemption audit table
CREATE TABLE "finance"."discount_coupon_redemptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "order_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discount_coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "discount_coupon_redemptions_coupon_user_order_key"
  ON "finance"."discount_coupon_redemptions" ("coupon_id", "user_id", "order_id");
CREATE INDEX "discount_coupon_redemptions_coupon_id_idx"
  ON "finance"."discount_coupon_redemptions" ("coupon_id");
CREATE INDEX "discount_coupon_redemptions_user_id_idx"
  ON "finance"."discount_coupon_redemptions" ("user_id");

-- Foreign keys
ALTER TABLE "finance"."discount_coupon_redemptions" ADD CONSTRAINT
  "discount_coupon_redemptions_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "finance"."discount_coupons" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."discount_coupon_redemptions" ADD CONSTRAINT
  "discount_coupon_redemptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "core"."users" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."discount_coupon_redemptions" ADD CONSTRAINT
  "discount_coupon_redemptions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "finance"."orders" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
