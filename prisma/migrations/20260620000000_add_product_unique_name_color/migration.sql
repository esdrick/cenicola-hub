-- Deactivate older duplicates so the unique constraint can be applied cleanly
UPDATE "products" SET "is_active" = false WHERE "id" = '3315e7e9-7023-49a0-b76c-6d75954679e4';

-- Partial unique index: only enforces uniqueness among active products,
-- so deactivated/deleted products don't block future re-creation
CREATE UNIQUE INDEX "products_name_color_key" ON "products"("name", "color") WHERE "is_active" = true;
