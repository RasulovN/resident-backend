-- Phase 2: business kind + food menu
DO $$ BEGIN
 CREATE TYPE "public"."business_kind" AS ENUM('food', 'retail', 'service', 'venue', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."reservation_status" AS ENUM('pending', 'confirmed', 'cancelled', 'seated', 'no_show', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "business_categories" ADD COLUMN IF NOT EXISTS "kind" "business_kind" DEFAULT 'other' NOT NULL;--> statement-breakpoint
UPDATE "business_categories" SET "kind" = 'food'    WHERE "slug" IN ('restaurant','cafe','bakery','home-food') AND "kind" = 'other';--> statement-breakpoint
UPDATE "business_categories" SET "kind" = 'retail'  WHERE "slug" IN ('grocery','mini-market','pharmacy','electronics') AND "kind" = 'other';--> statement-breakpoint
UPDATE "business_categories" SET "kind" = 'venue'   WHERE "slug" IN ('hotel') AND "kind" = 'other';--> statement-breakpoint
UPDATE "business_categories" SET "kind" = 'service' WHERE "slug" IN ('beauty-salon','barbershop','spa','kindergarten','school','training-center','fitness-center','clinic','dental','home-service','construction','auto-service','laundry','tailoring','handmade') AND "kind" = 'other';--> statement-breakpoint
ALTER TABLE "business_products" ADD COLUMN IF NOT EXISTS "section_id" uuid;--> statement-breakpoint
ALTER TABLE "business_products" ADD COLUMN IF NOT EXISTS "portion" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_menu_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_menu_sections" ADD CONSTRAINT "business_menu_sections_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
-- Phase 3: reservations
CREATE TABLE IF NOT EXISTS "business_reservation_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"slot_minutes" integer DEFAULT 60 NOT NULL,
	"party_size_max" integer,
	"lead_min_minutes" integer DEFAULT 0 NOT NULL,
	"note" text
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"resident_id" uuid,
	"resource_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"party_size" integer DEFAULT 1 NOT NULL,
	"status" "reservation_status" DEFAULT 'pending' NOT NULL,
	"contact_name" text,
	"contact_phone" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_reservation_settings" ADD CONSTRAINT "business_reservation_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_resources" ADD CONSTRAINT "business_resources_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_reservations" ADD CONSTRAINT "business_reservations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_reservations_biz_time_idx" ON "business_reservations" ("business_id","starts_at");
