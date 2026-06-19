-- Resident profile expansion: personal extras + address + additional details
ALTER TABLE "mobile_profiles" ADD COLUMN IF NOT EXISTS "middle_name" text;--> statement-breakpoint
ALTER TABLE "mobile_profiles" ADD COLUMN IF NOT EXISTS "passport_id" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resident_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"street" text,
	"building" text,
	"apartment" text,
	"household" text,
	"landmark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resident_addresses_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resident_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"education_level" text,
	"profession" text,
	"employment_status" text,
	"social_status" text,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"digital_skill" text,
	"hobbies" text,
	"happiness_level" integer,
	"health_notes" text,
	"special_needs" text,
	"has_car" boolean DEFAULT false NOT NULL,
	"car_model" text,
	"car_plate" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resident_details_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resident_addresses" ADD CONSTRAINT "resident_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resident_details" ADD CONSTRAINT "resident_details_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
