ALTER TABLE "finance"."subscription_purchases"
  ADD COLUMN IF NOT EXISTS "original_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount_applied" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "discount_percent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount_amount" INTEGER NOT NULL DEFAULT 0;

UPDATE "finance"."subscription_purchases"
SET "original_amount" = "amount"
WHERE "original_amount" = 0;
