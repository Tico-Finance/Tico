-- Safe to run more than once. Lead capture from the public lottery calculator (migration 0015).
-- Run the ALTER TYPE line on its own first if your SQL console wraps everything in one transaction.
ALTER TYPE "public"."subscriber_source" ADD VALUE IF NOT EXISTS 'calculator';
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "consent_at" timestamp with time zone;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "consent_text" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "marketing_consent_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "coupons_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"token" text NOT NULL,
	"lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"discount_percent" integer DEFAULT 20 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_token_unique" UNIQUE("token"),
	CONSTRAINT "coupons_email_unique" UNIQUE("email")
);
