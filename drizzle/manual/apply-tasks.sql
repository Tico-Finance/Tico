-- Safe to run more than once. Creates the manual tasks table (migration 0009).
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"due_at" date,
	"important" boolean DEFAULT false NOT NULL,
	"est_minutes" integer DEFAULT 15 NOT NULL,
	"goal" text DEFAULT 'admin' NOT NULL,
	"quadrant_override" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"done_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
