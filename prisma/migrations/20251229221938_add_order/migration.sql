/*
  Warnings:

  - Made the column `updated_at` on table `wallet_transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex (guarded; may not exist in some environments)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'catalog'
          AND indexname = 'products_search_text_trgm_idx'
    ) THEN
        DROP INDEX "catalog"."products_search_text_trgm_idx";
    END IF;
END $$;

-- AlterTable (guarded; column may not exist in some environments)
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

-- AlterTable (guarded; table may not exist in some environments)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'finance'
          AND table_name = 'wallets'
    ) THEN
        ALTER TABLE "finance"."wallets"
            ALTER COLUMN "updated_at" DROP DEFAULT;
    END IF;
END $$;

-- AlterTable (guarded; table may not exist in some environments)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'order_request_payments'
    ) THEN
        ALTER TABLE "public"."order_request_payments"
            ALTER COLUMN "status" SET DEFAULT 'PENDING';
    END IF;
END $$;

-- RenameIndex (guarded; index may not exist in some environments)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'finance'
          AND indexname = 'subscription_purchases_user_created_idx'
    ) THEN
        ALTER INDEX "finance"."subscription_purchases_user_created_idx"
            RENAME TO "subscription_purchases_user_id_created_at_idx";
    END IF;
END $$;

-- RenameIndex (guarded; index may not exist in some environments)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'finance'
          AND indexname = 'wallet_transactions_wallet_id_created_idx'
    ) THEN
        ALTER INDEX "finance"."wallet_transactions_wallet_id_created_idx"
            RENAME TO "wallet_transactions_wallet_id_created_at_idx";
    END IF;
END $$;
