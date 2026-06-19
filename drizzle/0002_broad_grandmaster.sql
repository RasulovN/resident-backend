CREATE TYPE "public"."apartment_type" AS ENUM('apartment', 'house', 'room', 'office');--> statement-breakpoint
CREATE TYPE "public"."building_status" AS ENUM('active', 'under_repair', 'under_construction', 'demolished');--> statement-breakpoint
CREATE TYPE "public"."building_type" AS ENUM('apartment_block', 'private_house', 'commercial', 'mixed', 'school', 'kindergarten', 'hospital', 'government', 'other');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('employed', 'unemployed', 'self_employed', 'student', 'pensioner', 'housewife', 'other');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."population_event_type" AS ENUM('birth', 'death', 'marriage', 'divorce', 'newborn', 'graduation', 'other');--> statement-breakpoint
CREATE TYPE "public"."relocation_status" AS ENUM('pending', 'approved', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."relocation_type" AS ENUM('internal', 'inter_mahalla', 'temporary', 'permanent', 'city_exit', 'city_enter');--> statement-breakpoint
CREATE TYPE "public"."resident_status" AS ENUM('active', 'inactive', 'relocated', 'deceased');--> statement-breakpoint
CREATE TABLE "streets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mahalla_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_ru" text,
	"slug" text NOT NULL,
	"district" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apartments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"floor" integer,
	"number" text NOT NULL,
	"area_sqm" integer,
	"rooms_count" integer,
	"apartment_type" "apartment_type" DEFAULT 'apartment' NOT NULL,
	"status" text DEFAULT 'occupied' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mahalla_id" uuid NOT NULL,
	"street_id" uuid,
	"name" text,
	"number" text NOT NULL,
	"building_type" "building_type" DEFAULT 'apartment_block' NOT NULL,
	"floors_count" integer,
	"apartments_count" integer,
	"year_built" integer,
	"latitude" text,
	"longitude" text,
	"model_url_3d" text,
	"status" "building_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mahalla_id" uuid NOT NULL,
	"apartment_id" uuid,
	"head_resident_id" uuid,
	"household_name" text,
	"happiness_score" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "population_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mahalla_id" uuid NOT NULL,
	"resident_id" uuid,
	"household_id" uuid,
	"event_type" text NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"notes" text,
	"documents" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resident_relocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"household_id" uuid,
	"from_mahalla_id" uuid,
	"to_mahalla_id" uuid,
	"from_apartment_id" uuid,
	"to_apartment_id" uuid,
	"relocation_type" text DEFAULT 'internal' NOT NULL,
	"reason" text,
	"relocation_date" timestamp with time zone,
	"from_admin_approved_at" timestamp with time zone,
	"to_admin_approved_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"documents" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "residents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mahalla_id" uuid NOT NULL,
	"household_id" uuid,
	"apartment_id" uuid,
	"user_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"middle_name" text,
	"phone" text,
	"phone2" text,
	"email" text,
	"passport_series" text,
	"passport_number" text,
	"pinfl" text,
	"birth_date" timestamp with time zone,
	"gender" "gender",
	"education_level" text,
	"occupation" text,
	"employment_status" "employment_status",
	"social_status" text,
	"languages" jsonb,
	"digital_skill_level" text,
	"disability_type" text,
	"disability_notes" text,
	"hobbies" jsonb,
	"interests" jsonb,
	"happiness_score" integer,
	"has_vehicle" boolean DEFAULT false NOT NULL,
	"status" "resident_status" DEFAULT 'active' NOT NULL,
	"registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "residents_pinfl_unique" UNIQUE("pinfl")
);
--> statement-breakpoint
ALTER TABLE "streets" ADD CONSTRAINT "streets_mahalla_id_organizations_id_fk" FOREIGN KEY ("mahalla_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_mahalla_id_organizations_id_fk" FOREIGN KEY ("mahalla_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_street_id_streets_id_fk" FOREIGN KEY ("street_id") REFERENCES "public"."streets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_mahalla_id_organizations_id_fk" FOREIGN KEY ("mahalla_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "population_events" ADD CONSTRAINT "population_events_mahalla_id_organizations_id_fk" FOREIGN KEY ("mahalla_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "population_events" ADD CONSTRAINT "population_events_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "population_events" ADD CONSTRAINT "population_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "population_events" ADD CONSTRAINT "population_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_relocations" ADD CONSTRAINT "resident_relocations_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_relocations" ADD CONSTRAINT "resident_relocations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_relocations" ADD CONSTRAINT "resident_relocations_from_mahalla_id_organizations_id_fk" FOREIGN KEY ("from_mahalla_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_relocations" ADD CONSTRAINT "resident_relocations_to_mahalla_id_organizations_id_fk" FOREIGN KEY ("to_mahalla_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_relocations" ADD CONSTRAINT "resident_relocations_from_apartment_id_apartments_id_fk" FOREIGN KEY ("from_apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_relocations" ADD CONSTRAINT "resident_relocations_to_apartment_id_apartments_id_fk" FOREIGN KEY ("to_apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_mahalla_id_organizations_id_fk" FOREIGN KEY ("mahalla_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;