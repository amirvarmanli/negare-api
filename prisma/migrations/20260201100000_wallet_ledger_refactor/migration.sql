-- Ensure required schemas and extensions
CREATE SCHEMA IF NOT EXISTS "core";
CREATE SCHEMA IF NOT EXISTS "finance";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'finance'
      AND t.typname = 'finance_wallet_status_enum'
  ) THEN
    CREATE TYPE "finance"."finance_wallet_status_enum" AS ENUM (
      'ACTIVE',
      'SUSPENDED'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'finance'
      AND t.typname = 'finance_wallet_transaction_reason_enum'
  ) THEN
    CREATE TYPE "finance"."finance_wallet_transaction_reason_enum" AS ENUM (
      'TOPUP',
      'ORDER_PAYMENT',
      'REFUND',
      'ADJUSTMENT',
      'WITHDRAWAL'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'finance'
      AND t.typname = 'finance_wallet_transaction_status_enum'
  ) THEN
    CREATE TYPE "finance"."finance_wallet_transaction_status_enum" AS ENUM (
      'PENDING',
      'SUCCESS',
      'FAILED',
      'CANCELED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "finance"."wallets" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'IRR',
  "status" "finance"."finance_wallet_status_enum" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wallets_user_id_key"
  ON "finance"."wallets" ("user_id");

ALTER TABLE "finance"."wallets"
  ADD CONSTRAINT "wallets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "core"."users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance"."wallet_transactions"
  ADD COLUMN IF NOT EXISTS "wallet_id" UUID,
  ADD COLUMN IF NOT EXISTS "reason" "finance"."finance_wallet_transaction_reason_enum",
  ADD COLUMN IF NOT EXISTS "status" "finance"."finance_wallet_transaction_status_enum" DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "amount" INTEGER,
  ADD COLUMN IF NOT EXISTS "balance_after" INTEGER,
  ADD COLUMN IF NOT EXISTS "description" VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP;

INSERT INTO "finance"."wallets" ("id", "user_id", "balance", "currency", "status", "created_at", "updated_at")
SELECT gen_random_uuid(), "user_id", COALESCE(SUM("amount_signed"), 0), 'IRR', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "finance"."wallet_transactions"
GROUP BY "user_id"
ON CONFLICT ("user_id") DO NOTHING;

UPDATE "finance"."wallet_transactions" wt
SET "wallet_id" = w."id"
FROM "finance"."wallets" w
WHERE wt."user_id" = w."user_id"
  AND wt."wallet_id" IS NULL;

UPDATE "finance"."wallet_transactions"
SET "amount" = ABS("amount_signed")
WHERE "amount" IS NULL;

UPDATE "finance"."wallet_transactions"
SET "reason" = (
  CASE
    WHEN "type"::text = 'TOPUP' THEN 'TOPUP'
    WHEN "type"::text = 'PURCHASE' THEN 'ORDER_PAYMENT'
    WHEN "type"::text = 'REFUND' THEN 'REFUND'
    WHEN "type"::text = 'ADJUST' THEN 'ADJUSTMENT'
    ELSE 'ADJUSTMENT'
  END
)::"finance"."finance_wallet_transaction_reason_enum"
WHERE "reason" IS NULL;

UPDATE "finance"."wallet_transactions"
SET "status" = 'SUCCESS'::"finance"."finance_wallet_transaction_status_enum"
WHERE "status" IS NULL;

UPDATE "finance"."wallet_transactions"
SET "updated_at" = "created_at"
WHERE "updated_at" IS NULL;

WITH ordered AS (
  SELECT
    "id",
    "user_id",
    SUM("amount_signed") OVER (PARTITION BY "user_id" ORDER BY "created_at", "id") AS balance_after
  FROM "finance"."wallet_transactions"
)
UPDATE "finance"."wallet_transactions" wt
SET "balance_after" = ordered.balance_after
FROM ordered
WHERE wt."id" = ordered."id"
  AND wt."balance_after" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'finance'
      AND t.typname = 'finance_wallet_transaction_type_enum'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'finance'
      AND t.typname = 'finance_wallet_transaction_type_enum'
      AND e.enumlabel = 'CREDIT'
  ) THEN
    CREATE TYPE "finance"."finance_wallet_transaction_type_enum_new" AS ENUM (
      'CREDIT',
      'DEBIT'
    );

    ALTER TABLE "finance"."wallet_transactions"
      ALTER COLUMN "type" TYPE "finance"."finance_wallet_transaction_type_enum_new"
      USING (
        CASE
          WHEN "amount_signed" < 0 THEN 'DEBIT'
          ELSE 'CREDIT'
        END
      )::"finance"."finance_wallet_transaction_type_enum_new";

    ALTER TYPE "finance"."finance_wallet_transaction_type_enum" RENAME TO "finance_wallet_transaction_type_enum_old";
    ALTER TYPE "finance"."finance_wallet_transaction_type_enum_new" RENAME TO "finance_wallet_transaction_type_enum";
    DROP TYPE "finance"."finance_wallet_transaction_type_enum_old";
  END IF;
END $$;

ALTER TABLE "finance"."wallet_transactions"
  ALTER COLUMN "wallet_id" SET NOT NULL,
  ALTER COLUMN "reason" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "amount" SET NOT NULL;

ALTER TABLE "finance"."wallet_transactions"
  DROP COLUMN IF EXISTS "amount_signed",
  DROP COLUMN IF EXISTS "reference_type";

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_finance_wallet_tx_idempotency"
  ON "finance"."wallet_transactions" ("wallet_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_created_idx"
  ON "finance"."wallet_transactions" ("wallet_id", "created_at");

CREATE INDEX IF NOT EXISTS "wallet_transactions_reference_id_idx"
  ON "finance"."wallet_transactions" ("reference_id");

ALTER TABLE "finance"."wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "finance"."wallets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TYPE IF EXISTS "finance"."finance_wallet_reference_type_enum";
