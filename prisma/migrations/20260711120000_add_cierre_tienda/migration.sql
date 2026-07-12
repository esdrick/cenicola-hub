-- CreateEnum
CREATE TYPE "TipoCierre" AS ENUM ('diario', 'semanal', 'quincenal', 'mensual');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "pago_verificado_at" TIMESTAMP(3),
ADD COLUMN     "incluido_en_cierre_id" TEXT;

-- CreateTable
CREATE TABLE "cierres_tienda" (
    "id" TEXT NOT NULL,
    "tipo" "TipoCierre" NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "generado_por_id" TEXT NOT NULL,
    "total_piezas" INTEGER NOT NULL,
    "resumen_totales" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierres_tienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_tienda_detalles" (
    "id" TEXT NOT NULL,
    "cierre_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "numero_orden" TEXT NOT NULL,
    "cliente_nombre" TEXT NOT NULL,
    "fecha_confirmacion" TIMESTAMP(3) NOT NULL,
    "cantidad_piezas" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL,
    "metodo_pago" TEXT NOT NULL,
    "comprobante_url" TEXT,

    CONSTRAINT "cierre_tienda_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cierres_tienda_fecha_inicio_fecha_fin_idx" ON "cierres_tienda"("fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE INDEX "cierre_tienda_detalles_cierre_id_idx" ON "cierre_tienda_detalles"("cierre_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_incluido_en_cierre_id_fkey" FOREIGN KEY ("incluido_en_cierre_id") REFERENCES "cierres_tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_tienda" ADD CONSTRAINT "cierres_tienda_generado_por_id_fkey" FOREIGN KEY ("generado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_tienda_detalles" ADD CONSTRAINT "cierre_tienda_detalles_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierres_tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
