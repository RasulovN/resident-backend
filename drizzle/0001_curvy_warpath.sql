ALTER TABLE "organizations" ADD COLUMN "subdomain" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "total_area_sqm" integer;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "established_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "boundary_geojson" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_subdomain_unique" UNIQUE("subdomain");