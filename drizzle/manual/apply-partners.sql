-- Safe to run more than once. Creates the partners tables (migration 0005).
CREATE TABLE IF NOT EXISTS "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"kind" text DEFAULT 'broker' NOT NULL,
	"name" text NOT NULL,
	"org" text,
	"instagram" text,
	"phone" text,
	"area" text,
	"address" text,
	"route" text,
	"why" text,
	"channel" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" text,
	"wave" text,
	"hook" text,
	"stage" text DEFAULT 'cold' NOT NULL,
	"next_action" text,
	"next_at" date,
	"follow_date" date,
	"coupon" boolean DEFAULT false NOT NULL,
	"coupon_code" text,
	"notes" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archive_reason" text,
	"external_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_user_external_key_unique" UNIQUE("user_id","external_key")
);

CREATE TABLE IF NOT EXISTS "partner_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL REFERENCES "public"."partners"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"kind" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"hook" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
