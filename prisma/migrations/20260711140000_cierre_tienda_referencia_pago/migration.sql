-- AlterTable
ALTER TABLE "cierre_tienda_detalles" DROP COLUMN "comprobante_url",
ADD COLUMN     "referencia_pago" TEXT NOT NULL DEFAULT '';

ALTER TABLE "cierre_tienda_detalles" ALTER COLUMN "referencia_pago" DROP DEFAULT;
