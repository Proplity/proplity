-- ISS-065: auto-pay charge runs claim a mandate and pause it after repeated declines.
ALTER TABLE "AutoPayMandate" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "AutoPayMandate" ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
