-- Safe to run more than once. Adds the undo snapshot column (migration 0007).
ALTER TABLE "partner_events" ADD COLUMN IF NOT EXISTS "prev" jsonb;
ALTER TABLE "client_events" ADD COLUMN IF NOT EXISTS "prev" jsonb;
