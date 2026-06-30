-- Add new values to PaymentType enum
ALTER TYPE "PaymentType" ADD VALUE 'efectivo_bs';
ALTER TYPE "PaymentType" ADD VALUE 'efectivo_usd';

-- Recreate enum without efectivo (requires renaming)
CREATE TYPE "PaymentType_new" AS ENUM ('efectivo_bs', 'efectivo_usd', 'transferencia', 'zelle', 'pago_movil', 'usdt');

ALTER TABLE "order_payments"
  ALTER COLUMN "payment_type" TYPE "PaymentType_new"
  USING "payment_type"::text::"PaymentType_new";

DROP TYPE "PaymentType";
ALTER TYPE "PaymentType_new" RENAME TO "PaymentType";
