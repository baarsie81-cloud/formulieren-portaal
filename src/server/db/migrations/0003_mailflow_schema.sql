CREATE TYPE "public"."document_category" AS ENUM('intake', 'contract');--> statement-breakpoint
CREATE TYPE "public"."email_kind" AS ENUM('invitation', 'confirmation');--> statement-breakpoint
CREATE TYPE "public"."organization_email_template_kind" AS ENUM('intake_invitation', 'contract_invitation', 'intake_confirmation', 'contract_confirmation');--> statement-breakpoint
CREATE TABLE "organization_email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "organization_email_template_kind" NOT NULL,
	"subject_template" text NOT NULL,
	"body_template" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_email_templates_organization_id_kind_unique" UNIQUE("organization_id","kind")
);
--> statement-breakpoint
ALTER TABLE "document_templates" ADD COLUMN "category" "document_category" DEFAULT 'intake' NOT NULL;--> statement-breakpoint
ALTER TABLE "form_requests" ADD COLUMN "document_category" "document_category";--> statement-breakpoint
ALTER TABLE "form_requests" ADD COLUMN "invitation_subject_snapshot" text;--> statement-breakpoint
ALTER TABLE "form_requests" ADD COLUMN "invitation_body_snapshot" text;--> statement-breakpoint
ALTER TABLE "form_requests" ADD COLUMN "confirmation_kind_snapshot" "organization_email_template_kind";--> statement-breakpoint
ALTER TABLE "form_requests" ADD COLUMN "confirmation_subject_snapshot" text;--> statement-breakpoint
ALTER TABLE "form_requests" ADD COLUMN "confirmation_body_snapshot" text;--> statement-breakpoint
ALTER TABLE "form_requests" ADD COLUMN "invitation_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "form_requests" ADD COLUMN "client_confirmation_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_events" ADD COLUMN "email_kind" "email_kind";--> statement-breakpoint
ALTER TABLE "organization_email_templates" ADD CONSTRAINT "organization_email_templates_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_email_templates_organization_id_idx" ON "organization_email_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_form_request_snapshots()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
    OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name
    OR NEW.recipient_email IS DISTINCT FROM OLD.recipient_email
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
  THEN
    RAISE EXCEPTION 'form_requests identity and recipient snapshots are immutable';
  END IF;

  IF (OLD.document_category IS NOT NULL AND NEW.document_category IS DISTINCT FROM OLD.document_category)
    OR (OLD.invitation_subject_snapshot IS NOT NULL AND NEW.invitation_subject_snapshot IS DISTINCT FROM OLD.invitation_subject_snapshot)
    OR (OLD.invitation_body_snapshot IS NOT NULL AND NEW.invitation_body_snapshot IS DISTINCT FROM OLD.invitation_body_snapshot)
    OR (OLD.confirmation_kind_snapshot IS NOT NULL AND NEW.confirmation_kind_snapshot IS DISTINCT FROM OLD.confirmation_kind_snapshot)
    OR (OLD.confirmation_subject_snapshot IS NOT NULL AND NEW.confirmation_subject_snapshot IS DISTINCT FROM OLD.confirmation_subject_snapshot)
    OR (OLD.confirmation_body_snapshot IS NOT NULL AND NEW.confirmation_body_snapshot IS DISTINCT FROM OLD.confirmation_body_snapshot)
    OR (OLD.invitation_sent_at IS NOT NULL AND NEW.invitation_sent_at IS DISTINCT FROM OLD.invitation_sent_at)
    OR (OLD.client_confirmation_sent_at IS NOT NULL AND NEW.client_confirmation_sent_at IS DISTINCT FROM OLD.client_confirmation_sent_at)
  THEN
    RAISE EXCEPTION 'form_requests mail snapshots are immutable once set';
  END IF;

  RETURN NEW;
END;
$$;
