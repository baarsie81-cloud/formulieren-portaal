CREATE TYPE "public"."actor_type" AS ENUM('user', 'client', 'system');--> statement-breakpoint
CREATE TYPE "public"."document_field_type" AS ENUM('text', 'textarea', 'date', 'checkbox', 'number', 'signature_area');--> statement-breakpoint
CREATE TYPE "public"."email_event_type" AS ENUM('sent', 'delivered', 'bounced', 'complained', 'opened');--> statement-breakpoint
CREATE TYPE "public"."form_document_status" AS ENUM('pending', 'in_progress', 'finalized', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."form_request_status" AS ENUM('sent', 'opened', 'in_progress', 'completed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."signature_method" AS ENUM('drawn', 'typed');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"external_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "clients_organization_id_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "organization_members_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "organization_members_organization_id_user_id_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_organization_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "organizations_clerk_organization_id_unique" UNIQUE("clerk_organization_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "document_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_template_id" uuid NOT NULL,
	"pdf_field_name" text NOT NULL,
	"value_key" text NOT NULL,
	"field_type" "document_field_type" NOT NULL,
	"page_number" integer DEFAULT 1 NOT NULL,
	"x" double precision,
	"y" double precision,
	"width" double precision,
	"height" double precision,
	"is_required" boolean DEFAULT false NOT NULL,
	"validation" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_fields_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "document_fields_template_pdf_field_name_unique" UNIQUE("document_template_id","pdf_field_name")
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"blob_key" text NOT NULL,
	"sha256" text NOT NULL,
	"status" "template_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_templates_organization_id_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "form_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_request_id" uuid NOT NULL,
	"document_template_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"template_blob_key" text NOT NULL,
	"template_sha256" text NOT NULL,
	"fields_schema_snapshot" jsonb NOT NULL,
	"field_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "form_document_status" DEFAULT 'pending' NOT NULL,
	"final_pdf_blob_key" text,
	"final_pdf_sha256" text,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_documents_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "form_documents_request_template_unique" UNIQUE("form_request_id","document_template_id"),
	CONSTRAINT "form_documents_finalized_pdf_present" CHECK ((
        ("form_documents"."status" <> 'finalized' AND "form_documents"."final_pdf_blob_key" IS NULL AND "form_documents"."final_pdf_sha256" IS NULL AND "form_documents"."finalized_at" IS NULL)
        OR
        ("form_documents"."status" = 'finalized' AND "form_documents"."final_pdf_blob_key" IS NOT NULL AND "form_documents"."final_pdf_sha256" IS NOT NULL AND "form_documents"."finalized_at" IS NOT NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "form_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_email" text NOT NULL,
	"status" "form_request_status" DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_requests_organization_id_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "form_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_request_id" uuid NOT NULL,
	"secure_token_id" uuid NOT NULL,
	"nonce_hash" text NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "form_sessions_organization_id_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "secure_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_request_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "secure_tokens_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "secure_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_document_id" uuid NOT NULL,
	"form_session_id" uuid NOT NULL,
	"declaration_text" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acceptances_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "acceptances_form_document_id_unique" UNIQUE("form_document_id")
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_document_id" uuid NOT NULL,
	"form_session_id" uuid NOT NULL,
	"signer_name" text NOT NULL,
	"method" "signature_method" NOT NULL,
	"signature_blob_key" text NOT NULL,
	"signature_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signatures_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "signatures_form_document_id_unique" UNIQUE("form_document_id")
);
--> statement-breakpoint
CREATE TABLE "reminder_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_request_id" uuid NOT NULL,
	"reminder_rule_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"skipped_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_deliveries_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "reminder_deliveries_request_sequence_unique" UNIQUE("form_request_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "reminder_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"delay_hours" integer NOT NULL,
	"sequence" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_rules_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "reminder_rules_organization_id_sequence_unique" UNIQUE("organization_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_user_id" uuid,
	"form_request_id" uuid,
	"form_document_id" uuid,
	"form_session_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_organization_id_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_request_id" uuid,
	"reminder_delivery_id" uuid,
	"provider_message_id" text NOT NULL,
	"event_type" "email_event_type" NOT NULL,
	"recipient_email" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_events_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "email_events_provider_message_id_event_type_unique" UNIQUE("provider_message_id","event_type")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_fields" ADD CONSTRAINT "document_fields_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_fields" ADD CONSTRAINT "document_fields_template_org_fk" FOREIGN KEY ("organization_id","document_template_id") REFERENCES "public"."document_templates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_documents" ADD CONSTRAINT "form_documents_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_documents" ADD CONSTRAINT "form_documents_request_org_fk" FOREIGN KEY ("organization_id","form_request_id") REFERENCES "public"."form_requests"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_documents" ADD CONSTRAINT "form_documents_template_org_fk" FOREIGN KEY ("organization_id","document_template_id") REFERENCES "public"."document_templates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_client_org_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_sessions" ADD CONSTRAINT "form_sessions_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_sessions" ADD CONSTRAINT "form_sessions_request_org_fk" FOREIGN KEY ("organization_id","form_request_id") REFERENCES "public"."form_requests"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_sessions" ADD CONSTRAINT "form_sessions_token_org_fk" FOREIGN KEY ("organization_id","secure_token_id") REFERENCES "public"."secure_tokens"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secure_tokens" ADD CONSTRAINT "secure_tokens_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secure_tokens" ADD CONSTRAINT "secure_tokens_request_org_fk" FOREIGN KEY ("organization_id","form_request_id") REFERENCES "public"."form_requests"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acceptances" ADD CONSTRAINT "acceptances_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acceptances" ADD CONSTRAINT "acceptances_document_org_fk" FOREIGN KEY ("organization_id","form_document_id") REFERENCES "public"."form_documents"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acceptances" ADD CONSTRAINT "acceptances_session_org_fk" FOREIGN KEY ("organization_id","form_session_id") REFERENCES "public"."form_sessions"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_document_org_fk" FOREIGN KEY ("organization_id","form_document_id") REFERENCES "public"."form_documents"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_session_org_fk" FOREIGN KEY ("organization_id","form_session_id") REFERENCES "public"."form_sessions"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_request_org_fk" FOREIGN KEY ("organization_id","form_request_id") REFERENCES "public"."form_requests"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_rule_org_fk" FOREIGN KEY ("organization_id","reminder_rule_id") REFERENCES "public"."reminder_rules"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_request_org_fk" FOREIGN KEY ("organization_id","form_request_id") REFERENCES "public"."form_requests"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_document_org_fk" FOREIGN KEY ("organization_id","form_document_id") REFERENCES "public"."form_documents"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_session_org_fk" FOREIGN KEY ("organization_id","form_session_id") REFERENCES "public"."form_sessions"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_request_org_fk" FOREIGN KEY ("organization_id","form_request_id") REFERENCES "public"."form_requests"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_delivery_org_fk" FOREIGN KEY ("organization_id","reminder_delivery_id") REFERENCES "public"."reminder_deliveries"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_organization_id_email_active_idx" ON "clients" USING btree ("organization_id","email") WHERE "clients"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "clients_organization_id_archived_at_idx" ON "clients" USING btree ("organization_id","archived_at");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_fields_organization_id_template_id_idx" ON "document_fields" USING btree ("organization_id","document_template_id");--> statement-breakpoint
CREATE INDEX "document_templates_organization_id_status_idx" ON "document_templates" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "form_documents_organization_id_request_id_idx" ON "form_documents" USING btree ("organization_id","form_request_id");--> statement-breakpoint
CREATE INDEX "form_requests_organization_id_status_created_at_idx" ON "form_requests" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "form_requests_organization_id_client_id_idx" ON "form_requests" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "form_requests_expires_at_idx" ON "form_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "form_sessions_request_id_started_at_idx" ON "form_sessions" USING btree ("form_request_id","started_at");--> statement-breakpoint
CREATE INDEX "form_sessions_secure_token_id_idx" ON "form_sessions" USING btree ("secure_token_id");--> statement-breakpoint
CREATE UNIQUE INDEX "secure_tokens_form_request_id_active_idx" ON "secure_tokens" USING btree ("form_request_id") WHERE "secure_tokens"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "secure_tokens_organization_id_request_id_idx" ON "secure_tokens" USING btree ("organization_id","form_request_id");--> statement-breakpoint
CREATE INDEX "reminder_deliveries_scheduled_for_pending_idx" ON "reminder_deliveries" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "audit_events_organization_id_created_at_idx" ON "audit_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_organization_id_entity_idx" ON "audit_events" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_form_request_id_created_at_idx" ON "audit_events" USING btree ("form_request_id","created_at");--> statement-breakpoint
CREATE INDEX "email_events_form_request_id_occurred_at_idx" ON "email_events" USING btree ("form_request_id","occurred_at");--> statement-breakpoint
CREATE INDEX "email_events_organization_id_event_type_idx" ON "email_events" USING btree ("organization_id","event_type");--> statement-breakpoint
CREATE OR REPLACE FUNCTION append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;--> statement-breakpoint
CREATE TRIGGER signatures_append_only
  BEFORE UPDATE OR DELETE ON signatures
  FOR EACH ROW
  EXECUTE PROCEDURE append_only_guard();--> statement-breakpoint
CREATE TRIGGER acceptances_append_only
  BEFORE UPDATE OR DELETE ON acceptances
  FOR EACH ROW
  EXECUTE PROCEDURE append_only_guard();--> statement-breakpoint
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW
  EXECUTE PROCEDURE append_only_guard();--> statement-breakpoint
CREATE TRIGGER email_events_append_only
  BEFORE UPDATE OR DELETE ON email_events
  FOR EACH ROW
  EXECUTE PROCEDURE append_only_guard();--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_finalized_form_documents()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'finalized' THEN
      RAISE EXCEPTION 'finalized form_documents rows cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'finalized' THEN
    RAISE EXCEPTION 'finalized form_documents rows are immutable';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER form_documents_finalized_guard
  BEFORE UPDATE OR DELETE ON form_documents
  FOR EACH ROW
  EXECUTE PROCEDURE protect_finalized_form_documents();--> statement-breakpoint
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

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER form_requests_snapshot_guard
  BEFORE UPDATE ON form_requests
  FOR EACH ROW
  EXECUTE PROCEDURE protect_form_request_snapshots();