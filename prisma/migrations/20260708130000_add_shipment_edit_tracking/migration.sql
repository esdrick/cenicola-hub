-- AlterTable
ALTER TABLE "order_shipments" ADD COLUMN "edited_at" TIMESTAMP(3),
ADD COLUMN "edited_by" TEXT;

-- AddForeignKey
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
