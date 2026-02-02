-- Add discount metadata columns required for platform-funded coupon settlement.
ALTER TABLE "finance"."orders"
  ADD COLUMN "discount_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discount_source" VARCHAR(32) NOT NULL DEFAULT 'NONE',
  ADD COLUMN "coupon_code" VARCHAR(64),
  ADD COLUMN "discount_reason" TEXT;
