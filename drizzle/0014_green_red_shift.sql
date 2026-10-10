DROP TYPE "public"."plan_section";--> statement-breakpoint
CREATE TYPE "public"."plan_section" AS ENUM('diagnostico', 'planejamento', 'orcamentos', 'cenarios');