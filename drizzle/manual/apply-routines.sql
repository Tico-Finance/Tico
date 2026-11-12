-- Safe to run more than once. Weekly routines and their daily log (migration 0013).
CREATE TABLE IF NOT EXISTS "routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"weekdays" integer[] NOT NULL,
	"start_min" integer,
	"est_minutes" integer DEFAULT 30 NOT NULL,
	"goal" text DEFAULT 'exposure' NOT NULL,
	"flexible" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "routine_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"routine_id" uuid NOT NULL REFERENCES "public"."routines"("id") ON DELETE cascade,
	"date" date NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routine_logs_routine_date_unique" UNIQUE("routine_id","date")
);
