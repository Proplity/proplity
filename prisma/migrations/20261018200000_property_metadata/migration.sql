-- Add metadata column to Property for pending changes and draft staging
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
