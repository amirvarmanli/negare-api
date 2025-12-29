-- Ensure required schema and enum for payment purpose
CREATE SCHEMA IF NOT EXISTS "finance";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'finance'
      AND t.typname = 'finance_payment_purpose_enum'
  ) THEN
    CREATE TYPE "finance"."finance_payment_purpose_enum" AS ENUM (
      'ORDER',
      'WALLET_TOPUP'
    );
  END IF;
END $$;

ALTER TABLE "finance"."payments"
  ADD COLUMN IF NOT EXISTS "purpose" "finance"."finance_payment_purpose_enum" NOT NULL DEFAULT 'ORDER';

UPDATE "finance"."payments"
SET "purpose" = 'WALLET_TOPUP'
WHERE "purpose" = 'ORDER'
  AND (
    "reference_type" = 'wallet_charge'
    OR ("reference_type" IS NULL AND "order_id" IS NULL)
  );

-- Convert wallet balances/transactions from IRR to TOMAN when currency is IRR.
WITH wallets_irr AS (
  SELECT id
  FROM "finance"."wallets"
  WHERE "currency" = 'IRR'
)
UPDATE "finance"."wallet_transactions" wt
SET "amount" = FLOOR(wt."amount" / 10),
    "balance_after" = CASE
      WHEN wt."balance_after" IS NULL THEN NULL
      ELSE FLOOR(wt."balance_after" / 10)
    END
FROM wallets_irr wi
WHERE wt."wallet_id" = wi.id;

UPDATE "finance"."wallets"
SET "balance" = FLOOR("balance" / 10),
    "currency" = 'TOMAN'
WHERE "currency" = 'IRR';

ALTER TABLE "finance"."wallets"
  ALTER COLUMN "currency" SET DEFAULT 'TOMAN';

-- Convert payments from IRR to TOMAN.
UPDATE "finance"."payments"
SET "amount" = FLOOR("amount" / 10),
    "currency" = 'TOMAN'
WHERE "currency" = 'IRR';

-- Convert order-related amounts from IRR to TOMAN.
WITH orders_irr AS (
  SELECT id
  FROM "finance"."orders"
  WHERE "currency" = 'IRR'
)
UPDATE "finance"."order_items" oi
SET "unit_price_snapshot" = FLOOR(oi."unit_price_snapshot" / 10),
    "line_total" = FLOOR(oi."line_total" / 10)
FROM orders_irr o
WHERE oi."order_id" = o.id;

UPDATE "finance"."orders"
SET "subtotal" = FLOOR("subtotal" / 10),
    "discount_value" = FLOOR("discount_value" / 10),
    "total" = FLOOR("total" / 10),
    "currency" = 'TOMAN'
WHERE "currency" = 'IRR';

-- Convert subscription purchases from IRR to TOMAN.
UPDATE "finance"."subscription_purchases"
SET "amount" = FLOOR("amount" / 10),
    "currency" = 'TOMAN'
WHERE "currency" = 'IRR';
