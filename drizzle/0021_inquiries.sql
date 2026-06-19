-- Citizen appeals / inquiries (Murojaatlar)
DO $$ BEGIN
 CREATE TYPE "public"."inquiry_status" AS ENUM('NEW', 'IN_PROGRESS', 'NEEDS_INFO', 'ESCALATED', 'RESOLVED', 'REJECTED', 'CLOSED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inquiry_category" AS ENUM('COMPLAINT', 'APPLICATION', 'SUGGESTION', 'SOCIAL_AID', 'UTILITY', 'INFRASTRUCTURE', 'SECURITY', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inquiry_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inquiry_event_type" AS ENUM('CREATED', 'STATUS_CHANGED', 'COMMENT', 'ASSIGNED', 'DEADLINE_EXTENDED', 'ESCALATED', 'RESOLVED', 'REOPENED', 'RATED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ticket_number" text NOT NULL,
	"resident_id" uuid,
	"category" "inquiry_category" DEFAULT 'COMPLAINT' NOT NULL,
	"priority" "inquiry_priority" DEFAULT 'MEDIUM' NOT NULL,
	"status" "inquiry_status" DEFAULT 'NEW' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"location" text,
	"contact_phone" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_to_id" uuid,
	"assigned_at" timestamp with time zone,
	"deadline_days" integer DEFAULT 15 NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"extension_count" integer DEFAULT 0 NOT NULL,
	"last_extension_reason" text,
	"escalated" boolean DEFAULT false NOT NULL,
	"escalated_at" timestamp with time zone,
	"escalated_by_id" uuid,
	"escalation_reason" text,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" uuid,
	"closed_at" timestamp with time zone,
	"rating" integer,
	"rating_comment" text,
	"last_event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inquiry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"type" "inquiry_event_type" NOT NULL,
	"author_id" uuid,
	"author_role" text DEFAULT 'staff' NOT NULL,
	"body" text,
	"from_status" "inquiry_status",
	"to_status" "inquiry_status",
	"is_internal" boolean DEFAULT false NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_resident_id_users_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_escalated_by_id_users_id_fk" FOREIGN KEY ("escalated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiry_events" ADD CONSTRAINT "inquiry_events_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiry_events" ADD CONSTRAINT "inquiry_events_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiries_org_status_idx" ON "inquiries" ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiries_resident_idx" ON "inquiries" ("resident_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiries_due_at_idx" ON "inquiries" ("due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiry_events_inquiry_idx" ON "inquiry_events" ("inquiry_id","created_at");
