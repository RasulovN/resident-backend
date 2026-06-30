-- mobile_profiles was originally created via `drizzle-kit push` in development, so
-- no generated migration ever held its CREATE TABLE. On a fresh database the later
-- ALTER TABLE statements (here and in 0013/0020/0022/0023) failed with
-- `relation "mobile_profiles" does not exist`. Create the base table here (the
-- first migration that touches it) so fresh deploys migrate cleanly. Idempotent:
-- existing databases already have the table, so IF NOT EXISTS makes this a no-op.
CREATE TABLE IF NOT EXISTS "mobile_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"birth_date" timestamp with time zone,
	"gender" text,
	"account_type" text DEFAULT 'individual' NOT NULL,
	"organization_name" text,
	"inn" text,
	"selected_mahalla_id" uuid,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_profiles_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mobile_profiles" ADD CONSTRAINT "mobile_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "mobile_profiles" ADD COLUMN IF NOT EXISTS "email" text;
