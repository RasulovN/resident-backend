CREATE TABLE IF NOT EXISTS "business_product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_product_images" ADD CONSTRAINT "business_product_images_product_id_business_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."business_products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_product_images_product_idx" ON "business_product_images" ("product_id","sort_order");
