ALTER TABLE "companies" DROP CONSTRAINT "companies_cnpj_unique";--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "document" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "cnpj";--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_document_unique" UNIQUE("document");