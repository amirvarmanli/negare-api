CREATE SCHEMA IF NOT EXISTS "finance";

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

    UPDATE "finance"."entitlements"
      SET "purchased_at" = "created_at"
      WHERE "purchased_at" IS NULL;

    ALTER TABLE "finance"."entitlements"
      ALTER COLUMN "purchased_at" SET NOT NULL;

    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY "user_id", "product_id"
               ORDER BY "purchased_at" ASC, "created_at" ASC
             ) AS rn
      FROM "finance"."entitlements"
    )
    DELETE FROM "finance"."entitlements" e
      USING ranked r
      WHERE e.id = r.id
        AND r.rn > 1;

    ALTER TABLE "finance"."entitlements"
      DROP CONSTRAINT IF EXISTS "entitlements_user_id_product_id_order_id_key";

    ALTER TABLE "finance"."entitlements"
      ADD CONSTRAINT "entitlements_user_id_product_id_key" UNIQUE ("user_id", "product_id");

    CREATE INDEX IF NOT EXISTS "entitlements_user_purchased_idx"
      ON "finance"."entitlements" ("user_id", "purchased_at");
    CREATE INDEX IF NOT EXISTS "entitlements_order_idx"
      ON "finance"."entitlements" ("order_id");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'finance'
      AND table_name = 'orders'
  ) THEN
    ALTER TABLE "finance"."orders"
      ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ(6);

    UPDATE "finance"."orders"
      SET "expires_at" = "created_at" + INTERVAL '15 minutes'
      WHERE "expires_at" IS NULL;
  END IF;
END $$;
