/*
  Warnings:

  - Made the column `updated_at` on table `wallet_transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'finance'
      AND table_name = 'wallet_transactions'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "finance"."wallet_transactions"
      ALTER COLUMN "updated_at" SET NOT NULL,
      ALTER COLUMN "updated_at" DROP DEFAULT;
  END IF;
END $$;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'finance'
      AND table_name = 'wallets'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "finance"."wallets" ALTER COLUMN "updated_at" DROP DEFAULT;
  END IF;
END $$;

-- RenameIndex
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'finance'
      AND c.relname = 'subscription_purchases_user_created_idx'
  ) THEN
    ALTER INDEX "finance"."subscription_purchases_user_created_idx"
      RENAME TO "subscription_purchases_user_id_created_at_idx";
  END IF;
END $$;

-- RenameIndex
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'finance'
      AND c.relname = 'wallet_transactions_wallet_id_created_idx'
  ) THEN
    ALTER INDEX "finance"."wallet_transactions_wallet_id_created_idx"
      RENAME TO "wallet_transactions_wallet_id_created_at_idx";
  END IF;
END $$;
