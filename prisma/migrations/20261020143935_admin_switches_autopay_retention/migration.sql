-- Admin switches for the two actions that are hardest to undo: charging cards automatically
-- (auto-pay) and deleting identity documents (retention), with the two retention periods. Both
-- switches default to off and the periods to ADR-0012's proposal (365 and 90 days), so nothing
-- changes for an existing deployment until an admin turns one on (and the deployment allows it).
ALTER TABLE "SystemSettings" ADD COLUMN     "autopayChargingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retentionAfterRejectionDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "retentionAfterTenancyDays" INTEGER NOT NULL DEFAULT 365,
ADD COLUMN     "retentionEnabled" BOOLEAN NOT NULL DEFAULT false;
