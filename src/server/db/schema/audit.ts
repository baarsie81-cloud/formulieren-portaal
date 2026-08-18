import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtColumn, utcTimestamp } from "./columns";
import { organizations, users } from "./core";
import { actorTypeEnum, emailEventTypeEnum } from "./enums";
import { formDocuments, formRequests } from "./forms";
import { reminderDeliveries } from "./reminders";
import { formSessions } from "./sessions";

type JsonObject = Record<string, unknown>;

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorUserId: uuid("actor_user_id"),
    formRequestId: uuid("form_request_id"),
    formDocumentId: uuid("form_document_id"),
    formSessionId: uuid("form_session_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata")
      .$type<JsonObject>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ipHash: text("ip_hash"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("audit_events_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("audit_events_organization_id_created_at_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("audit_events_organization_id_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
    ),
    index("audit_events_form_request_id_created_at_idx").on(
      table.formRequestId,
      table.createdAt,
    ),
    foreignKey({
      name: "audit_events_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "audit_events_actor_user_id_fk",
      columns: [table.actorUserId],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "audit_events_request_org_fk",
      columns: [table.organizationId, table.formRequestId],
      foreignColumns: [formRequests.organizationId, formRequests.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "audit_events_document_org_fk",
      columns: [table.organizationId, table.formDocumentId],
      foreignColumns: [formDocuments.organizationId, formDocuments.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "audit_events_session_org_fk",
      columns: [table.organizationId, table.formSessionId],
      foreignColumns: [formSessions.organizationId, formSessions.id],
    }).onDelete("restrict"),
  ],
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    formRequestId: uuid("form_request_id"),
    reminderDeliveryId: uuid("reminder_delivery_id"),
    providerMessageId: text("provider_message_id").notNull(),
    eventType: emailEventTypeEnum("event_type").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    occurredAt: utcTimestamp("occurred_at").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("email_events_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("email_events_provider_message_id_event_type_unique").on(
      table.providerMessageId,
      table.eventType,
    ),
    index("email_events_form_request_id_occurred_at_idx").on(
      table.formRequestId,
      table.occurredAt,
    ),
    index("email_events_organization_id_event_type_idx").on(
      table.organizationId,
      table.eventType,
    ),
    foreignKey({
      name: "email_events_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "email_events_request_org_fk",
      columns: [table.organizationId, table.formRequestId],
      foreignColumns: [formRequests.organizationId, formRequests.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "email_events_delivery_org_fk",
      columns: [table.organizationId, table.reminderDeliveryId],
      foreignColumns: [
        reminderDeliveries.organizationId,
        reminderDeliveries.id,
      ],
    }).onDelete("restrict"),
  ],
);
