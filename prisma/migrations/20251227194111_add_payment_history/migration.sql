-- AlterTable
ALTER TABLE "finance"."payments"
  ADD COLUMN "currency" VARCHAR(8),
  ADD COLUMN "failure_reason" VARCHAR(512),
  ADD COLUMN "paid_at" TIMESTAMPTZ(6),
  ADD COLUMN "updated_at" TIMESTAMPTZ(6);

UPDATE "finance"."payments"
SET "currency" = 'IRR'
WHERE "currency" IS NULL;

UPDATE "finance"."payments"
SET "updated_at" = "created_at"
WHERE "updated_at" IS NULL;

ALTER TABLE "finance"."payments"
  ALTER COLUMN "currency" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "finance"."payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "finance"."payments"("status");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'finance'
      AND c.relname = 'subscription_purchases_user_created_idx'
  ) THEN
    ALTER INDEX "finance"."subscription_purchases_user_created_idx"
      RENAME TO "subscription_purchases_user_id_created_at_idx";
  END IF;
END $$;
