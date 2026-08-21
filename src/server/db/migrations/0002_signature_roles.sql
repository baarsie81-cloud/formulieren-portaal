CREATE TYPE "public"."signature_role" AS ENUM('client', 'organization');--> statement-breakpoint
ALTER TABLE "document_fields" ADD COLUMN "signature_role" "signature_role" DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "signature_png_blob_key" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "signature_png_sha256" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "signature_signer_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "signature_signer_title" text;
