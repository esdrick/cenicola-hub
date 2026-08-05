-- CreateTable
CREATE TABLE "cierres_sistema" (
    "id" TEXT NOT NULL,
    "fecha_corte" TIMESTAMP(3) NOT NULL,
    "confirmado_por_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierres_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cierres_sistema_created_at_idx" ON "cierres_sistema"("created_at");

-- AddForeignKey
ALTER TABLE "cierres_sistema" ADD CONSTRAINT "cierres_sistema_confirmado_por_id_fkey" FOREIGN KEY ("confirmado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
