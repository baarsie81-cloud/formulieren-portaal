import {
  foreignKey,
  index,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtColumn, updatedAtColumn } from "./columns";
import { organizations } from "./core";
import { organizationEmailTemplateKindEnum } from "./enums";

export const organizationEmailTemplates = pgTable(
  "organization_email_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    kind: organizationEmailTemplateKindEnum("kind").notNull(),
    subjectTemplate: text("subject_template").notNull(),
    bodyTemplate: text("body_template").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    unique("organization_email_templates_organization_id_kind_unique").on(
      table.organizationId,
      table.kind,
    ),
    index("organization_email_templates_organization_id_idx").on(
      table.organizationId,
    ),
    foreignKey({
      name: "organization_email_templates_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
  ],
);
