-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_exchange_rate_id_fkey";

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "notas" TEXT,
ALTER COLUMN "exchange_rate_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "total_ventas" DECIMAL(10,2) NOT NULL,
    "comision" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable" (
    "id" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "paid_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_payable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_userId_mes_anio_key" ON "payroll_records"("userId", "mes", "anio");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_exchange_rate_id_fkey" FOREIGN KEY ("exchange_rate_id") REFERENCES "exchange_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
