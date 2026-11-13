-- Safe to run more than once. Facebook and TikTok pages for partners (migration 0014).
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "facebook" text;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "tiktok" text;
