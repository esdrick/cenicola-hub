-- AlterTable: add period range columns to support semana/quincena/mes filtering
ALTER TABLE "payroll_records" ADD COLUMN "periodo_tipo" TEXT NOT NULL DEFAULT 'mes';
ALTER TABLE "payroll_records" ADD COLUMN "periodo_inicio" DATE;
ALTER TABLE "payroll_records" ADD COLUMN "periodo_fin" DATE;

-- Backfill existing records: treat their mes/anio as a full-month period
UPDATE "payroll_records"
SET "periodo_inicio" = MAKE_DATE("anio", "mes", 1),
    "periodo_fin" = (MAKE_DATE("anio", "mes", 1) + INTERVAL '1 month' - INTERVAL '1 day')::date;

ALTER TABLE "payroll_records" ALTER COLUMN "periodo_inicio" SET NOT NULL;
ALTER TABLE "payroll_records" ALTER COLUMN "periodo_fin" SET NOT NULL;

-- DropIndex
DROP INDEX "payroll_records_userId_mes_anio_key";

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_userId_periodo_inicio_periodo_fin_key" ON "payroll_records"("userId", "periodo_inicio", "periodo_fin");
