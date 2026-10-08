CREATE TYPE "public"."person_type" AS ENUM('PF', 'PJ');--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "person_type" "person_type" DEFAULT 'PJ' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "document" text;--> statement-breakpoint
UPDATE "companies" SET "document" = "cnpj";
