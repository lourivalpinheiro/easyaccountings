CREATE TYPE "public"."investment_kind" AS ENUM('poupanca', 'cdb', 'lci_lca', 'tesouro', 'fundo', 'acoes', 'previdencia', 'cripto', 'outro');--> statement-breakpoint
CREATE TYPE "public"."plan_section" AS ENUM('diagnostico', 'planejamento', 'orcamentos', 'controle', 'cenarios');--> statement-breakpoint
CREATE TABLE "financial_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"title" text NOT NULL,
	"diagnosis_from" date NOT NULL,
	"diagnosis_to" date NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "investment_valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investment_id" uuid NOT NULL,
	"date" date NOT NULL,
	"balance" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investment_valuations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "investments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "investment_kind" DEFAULT 'outro' NOT NULL,
	"institution" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_budget_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"type" "cash_flow_type" NOT NULL,
	"category" text NOT NULL,
	"month" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_budget_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_amount" numeric(18, 2) NOT NULL,
	"initial_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"deadline" date NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"annual_return" numeric(7, 3) DEFAULT '0' NOT NULL,
	"investment_id" uuid,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"revenue_growth" numeric(7, 3) DEFAULT '0' NOT NULL,
	"expense_growth" numeric(7, 3) DEFAULT '0' NOT NULL,
	"inflation" numeric(7, 3) DEFAULT '0' NOT NULL,
	"investment_return" numeric(7, 3) DEFAULT '0' NOT NULL,
	"horizon_months" integer DEFAULT 12 NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_scenarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"label" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cash_flow_entries" ADD COLUMN "investment_id" uuid;--> statement-breakpoint
ALTER TABLE "financial_plans" ADD CONSTRAINT "financial_plans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_plans" ADD CONSTRAINT "financial_plans_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_valuations" ADD CONSTRAINT "investment_valuations_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_budget_items" ADD CONSTRAINT "plan_budget_items_plan_id_financial_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."financial_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_files" ADD CONSTRAINT "plan_files_plan_id_financial_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."financial_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_files" ADD CONSTRAINT "plan_files_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_goals" ADD CONSTRAINT "plan_goals_plan_id_financial_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."financial_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_goals" ADD CONSTRAINT "plan_goals_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_scenarios" ADD CONSTRAINT "plan_scenarios_plan_id_financial_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."financial_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_financial_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."financial_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_plans_company_year" ON "financial_plans" USING btree ("company_id","year");--> statement-breakpoint
CREATE UNIQUE INDEX "investment_valuations_investment_date" ON "investment_valuations" USING btree ("investment_id","date");--> statement-breakpoint
CREATE INDEX "investments_company" ON "investments" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_budget_items_unique" ON "plan_budget_items" USING btree ("plan_id","type","category","month");--> statement-breakpoint
CREATE INDEX "plan_files_plan" ON "plan_files" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_goals_plan" ON "plan_goals" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_scenarios_plan" ON "plan_scenarios" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_versions_plan_number" ON "plan_versions" USING btree ("plan_id","number");--> statement-breakpoint
ALTER TABLE "cash_flow_entries" ADD CONSTRAINT "cash_flow_entries_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE set null ON UPDATE no action;