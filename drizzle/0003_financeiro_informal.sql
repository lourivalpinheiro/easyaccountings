CREATE TYPE "public"."cash_flow_type" AS ENUM('entrada', 'saida');--> statement-breakpoint
ALTER TYPE "public"."person_type" ADD VALUE 'INF';--> statement-breakpoint
CREATE TABLE "cash_flow_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"date" date NOT NULL,
	"type" "cash_flow_type" NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"amount" numeric(18, 2) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_flow_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "document" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_flow_entries" ADD CONSTRAINT "cash_flow_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flow_entries" ADD CONSTRAINT "cash_flow_entries_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_flow_entries_company_date" ON "cash_flow_entries" USING btree ("company_id","date");