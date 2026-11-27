ALTER TYPE "public"."subscriber_source" ADD VALUE IF NOT EXISTS 'calculator';--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "consent_text" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "marketing_consent_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "coupons_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"token" text NOT NULL,
	"lead_id" uuid,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"discount_percent" integer DEFAULT 20 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_token_unique" UNIQUE("token"),
	CONSTRAINT "coupons_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
