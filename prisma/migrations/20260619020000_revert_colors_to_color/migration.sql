-- Revert colors (String[]) back to color (String?)
ALTER TABLE "products" ADD COLUMN "color" TEXT;
UPDATE "products" SET "color" = colors[1] WHERE array_length(colors, 1) > 0;
ALTER TABLE "products" DROP COLUMN "colors";

-- Recreate index
CREATE INDEX "products_color_idx" ON "products"("color");
