-- AlterTable: rename color to colors and convert to array
ALTER TABLE "products" ADD COLUMN "colors" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "products" SET "colors" = ARRAY["color"] WHERE "color" IS NOT NULL;
ALTER TABLE "products" DROP COLUMN "color";

-- DropIndex
DROP INDEX IF EXISTS "products_color_idx";
