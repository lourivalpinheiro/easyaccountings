CREATE TYPE "public"."account_group" AS ENUM('ativo', 'passivo', 'patrimonio_liquido', 'despesa', 'receita', 'apuracao');--> statement-breakpoint
CREATE TYPE "public"."entry_side" AS ENUM('D', 'C');--> statement-breakpoint
CREATE TYPE "public"."nature" AS ENUM('D', 'C');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "account_group_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"group" "account_group" NOT NULL,
	"nature" "nature",
	"prefix" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_group_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"reduced_code" integer NOT NULL,
	"classification" text NOT NULL,
	"name" text NOT NULL,
	"dre_category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "budget_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "closing_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"net_result" numeric(18, 2) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "closing_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "closing_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"result_account_id" uuid,
	"profit_account_id" uuid,
	"loss_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "closing_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"cnpj" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dre_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dre_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "explanatory_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "explanatory_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "history_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" integer NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "history_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"date" date NOT NULL,
	"history_code" integer,
	"description" text NOT NULL,
	"closing_batch_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"side" "entry_side" NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mfa_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mfa_challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account_group_settings" ADD CONSTRAINT "account_group_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_dre_category_id_dre_categories_id_fk" FOREIGN KEY ("dre_category_id") REFERENCES "public"."dre_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_batches" ADD CONSTRAINT "closing_batches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_batches" ADD CONSTRAINT "closing_batches_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_settings" ADD CONSTRAINT "closing_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_settings" ADD CONSTRAINT "closing_settings_result_account_id_accounts_id_fk" FOREIGN KEY ("result_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_settings" ADD CONSTRAINT "closing_settings_profit_account_id_accounts_id_fk" FOREIGN KEY ("profit_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_settings" ADD CONSTRAINT "closing_settings_loss_account_id_accounts_id_fk" FOREIGN KEY ("loss_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dre_categories" ADD CONSTRAINT "dre_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanatory_notes" ADD CONSTRAINT "explanatory_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanatory_notes" ADD CONSTRAINT "explanatory_notes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_codes" ADD CONSTRAINT "history_codes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_closing_batch_id_closing_batches_id_fk" FOREIGN KEY ("closing_batch_id") REFERENCES "public"."closing_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_group_settings_company_group" ON "account_group_settings" USING btree ("company_id","group");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_company_classification" ON "accounts" USING btree ("company_id","classification");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_company_reduced" ON "accounts" USING btree ("company_id","reduced_code");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_items_budget_account" ON "budget_items" USING btree ("budget_id","account_id");--> statement-breakpoint
CREATE INDEX "dre_categories_company" ON "dre_categories" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "history_codes_company_code" ON "history_codes" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_company_number" ON "journal_entries" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "journal_entries_company_date" ON "journal_entries" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "journal_lines_entry" ON "journal_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account" ON "journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "mfa_challenges_session" ON "mfa_challenges" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_auth_users_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade;
