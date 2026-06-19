-- Profile privacy: show/hide phone & email on public profile
ALTER TABLE "mobile_profiles" ADD COLUMN IF NOT EXISTS "show_phone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mobile_profiles" ADD COLUMN IF NOT EXISTS "show_email" boolean DEFAULT false NOT NULL;
