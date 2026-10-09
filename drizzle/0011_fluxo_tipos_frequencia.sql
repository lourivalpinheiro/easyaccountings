CREATE TYPE "public"."cash_flow_frequency" AS ENUM('unica', 'diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual');--> statement-breakpoint
ALTER TYPE "public"."cash_flow_type" ADD VALUE 'economia';--> statement-breakpoint
ALTER TYPE "public"."cash_flow_type" ADD VALUE 'cartao_credito';--> statement-breakpoint
ALTER TABLE "cash_flow_entries" ADD COLUMN "frequency" "cash_flow_frequency" DEFAULT 'unica' NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_flow_entries" ADD COLUMN "series_id" uuid;--> statement-breakpoint
CREATE INDEX "cash_flow_entries_series" ON "cash_flow_entries" USING btree ("series_id");