-- AlterTable
ALTER TABLE "cierres_tienda" ADD COLUMN     "canal" "OrderChannel" NOT NULL DEFAULT 'tienda';

ALTER TABLE "cierres_tienda" ALTER COLUMN "canal" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "cierres_tienda_canal_idx" ON "cierres_tienda"("canal");
