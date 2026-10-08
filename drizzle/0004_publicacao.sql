ALTER TABLE "companies" ADD COLUMN "public_token" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_public_token_unique" UNIQUE("public_token");