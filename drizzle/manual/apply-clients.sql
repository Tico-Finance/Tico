-- Safe to run more than once. Creates the clients tables (migration 0006).
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"phone" text,
	"process" text DEFAULT 'second_hand_tabu' NOT NULL,
	"stage_index" integer DEFAULT 0 NOT NULL,
	"stage_started_at" date,
	"stage_due_at" date,
	"status" text DEFAULT 'active' NOT NULL,
	"pending_message" text,
	"lead_id" uuid REFERENCES "public"."leads"("id") ON DELETE set null,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "client_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL REFERENCES "public"."clients"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"kind" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"stage_key" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
