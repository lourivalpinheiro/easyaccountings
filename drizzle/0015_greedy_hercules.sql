CREATE TYPE "public"."provision_type" AS ENUM('pagar', 'receber');--> statement-breakpoint
CREATE TABLE "provisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"type" "provision_type" NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"due_date" date NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"settled_at" date,
	"cash_flow_entry_id" uuid,
	"journal_entry_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "provisions" ADD CONSTRAINT "provisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisions" ADD CONSTRAINT "provisions_cash_flow_entry_id_cash_flow_entries_id_fk" FOREIGN KEY ("cash_flow_entry_id") REFERENCES "public"."cash_flow_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisions" ADD CONSTRAINT "provisions_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisions" ADD CONSTRAINT "provisions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provisions_company_due" ON "provisions" USING btree ("company_id","due_date");