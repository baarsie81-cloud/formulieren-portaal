import { pgEnum } from "drizzle-orm/pg-core";

export const memberRoleEnum = pgEnum("member_role", ["admin", "member"]);

export const templateStatusEnum = pgEnum("template_status", [
  "active",
  "archived",
]);

export const documentFieldTypeEnum = pgEnum("document_field_type", [
  "text",
  "textarea",
  "date",
  "checkbox",
  "number",
  "signature_area",
]);

export const formRequestStatusEnum = pgEnum("form_request_status", [
  "sent",
  "opened",
  "in_progress",
  "completed",
  "expired",
  "cancelled",
]);

export const formDocumentStatusEnum = pgEnum("form_document_status", [
  "pending",
  "in_progress",
  "finalized",
  "cancelled",
]);

export const signatureMethodEnum = pgEnum("signature_method", [
  "drawn",
  "typed",
]);

export const actorTypeEnum = pgEnum("actor_type", ["user", "client", "system"]);

export const emailEventTypeEnum = pgEnum("email_event_type", [
  "sent",
  "delivered",
  "bounced",
  "complained",
  "opened",
]);
