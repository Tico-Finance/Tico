-- Safe to run more than once. One business plan per calendar year (migration 0012).
ALTER TABLE "plan_settings" ADD COLUMN IF NOT EXISTS "year" integer DEFAULT 2026 NOT NULL;
ALTER TABLE "plan_settings" ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone;
ALTER TABLE "plan_settings" ADD COLUMN IF NOT EXISTS "summary" jsonb;
ALTER TABLE "plan_settings" DROP CONSTRAINT IF EXISTS "plan_settings_pkey";
ALTER TABLE "plan_settings" DROP CONSTRAINT IF EXISTS "plan_settings_user_id_year_pk";
ALTER TABLE "plan_settings" ADD CONSTRAINT "plan_settings_user_id_year_pk" PRIMARY KEY ("user_id","year");
-- The existing plan becomes the calendar-year 2026 plan.
UPDATE "plan_settings" SET "data" = jsonb_set("data", '{start}', '0') WHERE "year" = 2026;
