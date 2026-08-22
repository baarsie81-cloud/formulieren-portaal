ALTER TABLE "form_requests" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "form_requests_organization_id_archived_at_idx" ON "form_requests" USING btree ("organization_id","archived_at");
