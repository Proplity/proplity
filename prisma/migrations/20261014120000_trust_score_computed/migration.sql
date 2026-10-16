-- ISS-013: trustScore is computed by a worker now, not a constant 100.
-- Existing rows still hold the old placeholder; clear it so the UI shows
-- "not scored yet" until the next scoring run.
ALTER TABLE "Property" ALTER COLUMN "trustScore" DROP DEFAULT;
UPDATE "Property" SET "trustScore" = NULL WHERE "trustScore" = 100;
