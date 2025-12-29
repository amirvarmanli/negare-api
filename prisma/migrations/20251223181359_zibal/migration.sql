/*
  Warnings:

  - A unique constraint covering the columns `[track_id]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "finance"."finance_payment_provider_enum" ADD VALUE 'ZIBAL';

-- AlterTable
ALTER TABLE "finance"."payments" ADD COLUMN     "track_id" VARCHAR(128);

-- CreateIndex
CREATE UNIQUE INDEX "payments_track_id_key" ON "finance"."payments"("track_id");
