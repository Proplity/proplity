-- ISS-056: a lease can have only one ACTIVE auto-pay mandate. Where duplicates
-- already exist, keep the newest and cancel the rest (soft-cancel, never delete).
UPDATE "AutoPayMandate" m
SET "status" = 'CANCELLED'
WHERE m."status" = 'ACTIVE'
  AND EXISTS (
    SELECT 1 FROM "AutoPayMandate" n
    WHERE n."leaseId" = m."leaseId" AND n."status" = 'ACTIVE'
      AND (n."createdAt", n."id") > (m."createdAt", m."id")
  );

CREATE UNIQUE INDEX "AutoPayMandate_one_active_per_lease"
  ON "AutoPayMandate"("leaseId") WHERE "status" = 'ACTIVE';
