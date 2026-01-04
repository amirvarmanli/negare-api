/*
  Warnings:

  - Made the column `updated_at` on table `wallet_transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX IF EXISTS "catalog"."products_search_text_trgm_idx";

-- AlterTable
ALTER TABLE "finance"."wallet_transactions" ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "finance"."wallets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "order_request_payments_track_idx" ON "public"."order_request_payments"("track_id");

-- RenameIndex
ALTER INDEX "finance"."wallet_transactions_wallet_id_created_idx" RENAME TO "wallet_transactions_wallet_id_created_at_idx";
