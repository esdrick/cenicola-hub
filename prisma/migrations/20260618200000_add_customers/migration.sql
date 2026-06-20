-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('V', 'P', 'J', 'E');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "doc_type" "DocumentType" NOT NULL,
    "doc_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_doc_type_doc_number_key" ON "customers"("doc_type", "doc_number");

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "customer_id" TEXT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
