ALTER TABLE "orders" ALTER COLUMN "pricing_method" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "pricing_method" DROP NOT NULL;
-- Reset existing orders so pricing_method is derived from first payment going forward
UPDATE "orders" SET "pricing_method" = NULL;
