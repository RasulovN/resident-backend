CREATE TABLE "mahalla_territories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"district" text NOT NULL,
	"svg_path" text NOT NULL,
	"center_x" numeric(8, 2) NOT NULL,
	"center_y" numeric(8, 2) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mahalla_territories_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "chairman" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "chairman_phone" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "population_count" integer;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "territory_id" uuid;