CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"format" text DEFAULT 'post' NOT NULL,
	"topic" text,
	"status" text DEFAULT 'idea' NOT NULL,
	"planned_at" date,
	"published_at" date,
	"url" text,
	"caption" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"draft_post_id" uuid,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics_at" timestamp with time zone,
	"screenshots" text[] DEFAULT '{}' NOT NULL,
	"insights" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_user_code_unique" UNIQUE("user_id","code"),
	CONSTRAINT "content_items_user_draft_unique" UNIQUE("user_id","draft_post_id")
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_draft_post_id_draft_posts_id_fk" FOREIGN KEY ("draft_post_id") REFERENCES "public"."draft_posts"("id") ON DELETE set null ON UPDATE no action;