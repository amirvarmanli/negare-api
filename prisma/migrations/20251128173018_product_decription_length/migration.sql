/*
  Warnings:

  - You are about to alter the column `description` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(1400)`.

*/
-- AlterTable
ALTER TABLE "catalog"."products" ALTER COLUMN "description" SET DATA TYPE VARCHAR(1400),
ALTER COLUMN "seoTitle" SET DATA TYPE VARCHAR(250),
ALTER COLUMN "seoDescription" SET DATA TYPE VARCHAR(1400);
