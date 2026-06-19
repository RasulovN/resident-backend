-- Chat: unified DM + user groups, plus user search fields
DO $$ BEGIN
 CREATE TYPE "public"."chat_room_type" AS ENUM('mahalla', 'group', 'dm');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD COLUMN IF NOT EXISTS "type" "chat_room_type" DEFAULT 'group' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD COLUMN IF NOT EXISTS "dm_key" text;--> statement-breakpoint
ALTER TABLE "chat_rooms" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_rooms" ALTER COLUMN "title" SET DEFAULT '';--> statement-breakpoint
-- Existing admin-created rooms are mahalla community chats.
UPDATE "chat_rooms" SET "type" = 'mahalla' WHERE "organization_id" IS NOT NULL AND "type" = 'group';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_rooms_dm_key_uniq" ON "chat_rooms" ("dm_key");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");
