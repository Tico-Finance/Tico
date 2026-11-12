ALTER TABLE "plan_settings" ADD COLUMN "year" integer DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_settings" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_settings" ADD COLUMN "summary" jsonb;--> statement-breakpoint
ALTER TABLE "plan_settings" DROP CONSTRAINT "plan_settings_pkey";--> statement-breakpoint
ALTER TABLE "plan_settings" ADD CONSTRAINT "plan_settings_user_id_year_pk" PRIMARY KEY("user_id","year");
