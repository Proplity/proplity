-- ISS-052: a redelivered webhook must never credit twice. Refuse to run if
-- production already holds duplicate references, so no payment row is ever
-- silently dropped; resolve those by hand first.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Payment" WHERE "transactionRef" IS NOT NULL
    GROUP BY "transactionRef" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Payment.transactionRef values exist; resolve them before applying this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "Payment_transactionRef_key" ON "Payment"("transactionRef");
