/*
  Warnings:

  - You are about to drop the column `price_usd` on the `product_variants` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PricingMethod" AS ENUM ('bcv', 'divisas');

-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "pricing_method" "PricingMethod" NOT NULL DEFAULT 'bcv';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "adjusted_total_usd" DECIMAL(10,2),
ADD COLUMN     "pricing_method" "PricingMethod" NOT NULL DEFAULT 'bcv';

-- AlterTable: add new price columns first (so existing data can be backfilled)
ALTER TABLE "product_variants"
ADD COLUMN     "price_bcv" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "price_divisas" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "price_mayor_bcv" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "price_mayor_divisas" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill: preserve existing price_usd as the BCV retail price
UPDATE "product_variants" SET "price_bcv" = "price_usd";

-- AlterTable: now safe to drop the old column
ALTER TABLE "product_variants" DROP COLUMN "price_usd";
