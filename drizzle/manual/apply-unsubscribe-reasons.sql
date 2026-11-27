-- Safe to run more than once. Reasons given on the unsubscribe page (migration 0016).
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "unsubscribe_reasons" text[];
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "unsubscribe_note" text;
