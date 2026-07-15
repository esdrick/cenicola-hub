-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "quantity_bcv" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantity_divisas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal_bcv_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal_divisas_usd" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "quantity_bcv" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantity_divisas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal_bcv_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal_divisas_usd" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "total_bcv_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total_divisas_usd" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill: every row created before this migration was single-currency (no split
-- feature existed yet), so its full quantity/subtotal/total belongs to the one bucket
-- matching its existing pricing_method. NULL pricing_method (orders never paid) defaults
-- to the "bcv" bucket, matching the fallback already used elsewhere (e.g. lib/cierre-tienda.ts).
UPDATE "order_items" oi
SET "quantity_bcv" = CASE WHEN o."pricing_method" = 'divisas' THEN 0 ELSE oi."quantity" END,
    "quantity_divisas" = CASE WHEN o."pricing_method" = 'divisas' THEN oi."quantity" ELSE 0 END,
    "subtotal_bcv_usd" = CASE WHEN o."pricing_method" = 'divisas' THEN 0 ELSE oi."subtotal_usd" END,
    "subtotal_divisas_usd" = CASE WHEN o."pricing_method" = 'divisas' THEN oi."subtotal_usd" ELSE 0 END
FROM "orders" o
WHERE oi."order_id" = o."id";

UPDATE "orders"
SET "total_bcv_usd" = CASE WHEN "pricing_method" = 'divisas' THEN 0 ELSE "total_usd" END,
    "total_divisas_usd" = CASE WHEN "pricing_method" = 'divisas' THEN "total_usd" ELSE 0 END;

UPDATE "cart_items" ci
SET "quantity_bcv" = CASE WHEN c."pricing_method" = 'divisas' THEN 0 ELSE ci."quantity" END,
    "quantity_divisas" = CASE WHEN c."pricing_method" = 'divisas' THEN ci."quantity" ELSE 0 END,
    "subtotal_bcv_usd" = CASE WHEN c."pricing_method" = 'divisas' THEN 0 ELSE ci."unit_price_usd" * ci."quantity" END,
    "subtotal_divisas_usd" = CASE WHEN c."pricing_method" = 'divisas' THEN ci."unit_price_usd" * ci."quantity" ELSE 0 END
FROM "carts" c
WHERE ci."cart_id" = c."id";
