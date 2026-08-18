import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtColumn, utcTimestamp } from "./columns";
import { organizations } from "./core";
import { formRequests } from "./forms";

export const reminderRules = pgTable(
  "reminder_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    delayHours: integer("delay_hours").notNull(),
    sequence: integer("sequence").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("reminder_rules_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("reminder_rules_organization_id_sequence_unique").on(
      table.organizationId,
      table.sequence,
    ),
    foreignKey({
      name: "reminder_rules_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
  ],
);

export const reminderDeliveries = pgTable(
  "reminder_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    formRequestId: uuid("form_request_id").notNull(),
    reminderRuleId: uuid("reminder_rule_id").notNull(),
    sequence: integer("sequence").notNull(),
    scheduledFor: utcTimestamp("scheduled_for").notNull(),
    sentAt: utcTimestamp("sent_at"),
    skippedReason: text("skipped_reason"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("reminder_deliveries_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("reminder_deliveries_request_sequence_unique").on(
      table.formRequestId,
      table.sequence,
    ),
    index("reminder_deliveries_scheduled_for_pending_idx").on(
      table.scheduledFor,
    ),
    foreignKey({
      name: "reminder_deliveries_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "reminder_deliveries_request_org_fk",
      columns: [table.organizationId, table.formRequestId],
      foreignColumns: [formRequests.organizationId, formRequests.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "reminder_deliveries_rule_org_fk",
      columns: [table.organizationId, table.reminderRuleId],
      foreignColumns: [reminderRules.organizationId, reminderRules.id],
    }).onDelete("restrict"),
  ],
);
