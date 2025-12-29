-- DropIndex
DROP INDEX IF EXISTS "finance"."entitlements_user_id_product_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "finance"."entitlements_user_id_product_id_order_id_key";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'finance'
      AND table_name = 'entitlements'
  ) THEN
    ALTER TABLE "finance"."entitlements"
      ADD COLUMN IF NOT EXISTS "purchased_at" TIMESTAMPTZ(6);

    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'finance'
        AND table_name = 'orders'
    ) THEN
      UPDATE "finance"."entitlements" e
        SET "purchased_at" = COALESCE(o."paid_at", e."created_at", NOW())
        FROM "finance"."orders" o
        WHERE e."order_id" = o."id"
          AND e."purchased_at" IS NULL;
    END IF;

    UPDATE "finance"."entitlements"
      SET "purchased_at" = COALESCE("purchased_at", "created_at", NOW())
      WHERE "purchased_at" IS NULL;

    ALTER TABLE "finance"."entitlements"
      ALTER COLUMN "purchased_at" SET DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE "finance"."entitlements"
      ALTER COLUMN "purchased_at" SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'subscription_purchases_user_created_idx'
      AND n.nspname = 'finance'
  ) THEN
    ALTER INDEX "finance"."subscription_purchases_user_created_idx"
      RENAME TO "subscription_purchases_user_id_created_at_idx";
  END IF;
END $$;
