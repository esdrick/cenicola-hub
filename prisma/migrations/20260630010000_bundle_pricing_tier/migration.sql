ALTER TABLE "product_variants"
ADD COLUMN "price_bundle_bcv"     DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "price_bundle_divisas" DECIMAL(10,2) NOT NULL DEFAULT 0;
