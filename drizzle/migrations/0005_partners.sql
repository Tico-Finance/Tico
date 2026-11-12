CREATE TABLE "partner_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"hook" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "partner_events" ADD CONSTRAINT "partner_events_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_events" ADD CONSTRAINT "partner_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;