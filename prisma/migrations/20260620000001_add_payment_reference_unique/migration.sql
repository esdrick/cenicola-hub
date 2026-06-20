-- Partial unique index: prevents duplicate bank references across non-rejected payments.
-- Excludes cash (reference_hash IS NULL) and rejected payments so they don't block new entries.
CREATE UNIQUE INDEX "order_payments_reference_hash_payment_type_key"
  ON "order_payments"("reference_hash", "payment_type")
  WHERE "reference_hash" IS NOT NULL AND "status" != 'rechazado';
