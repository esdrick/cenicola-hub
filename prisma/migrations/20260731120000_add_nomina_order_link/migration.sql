-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "incluido_en_nomina_id" TEXT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_incluido_en_nomina_id_fkey" FOREIGN KEY ("incluido_en_nomina_id") REFERENCES "payroll_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
