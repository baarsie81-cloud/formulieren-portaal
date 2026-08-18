import {
  foreignKey,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtColumn, utcTimestamp } from "./columns";
import { organizations } from "./core";
import { signatureMethodEnum } from "./enums";
import { formDocuments } from "./forms";
import { formSessions } from "./sessions";

export const signatures = pgTable(
  "signatures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    formDocumentId: uuid("form_document_id").notNull(),
    formSessionId: uuid("form_session_id").notNull(),
    signerName: text("signer_name").notNull(),
    method: signatureMethodEnum("method").notNull(),
    signatureBlobKey: text("signature_blob_key").notNull(),
    signatureSha256: text("signature_sha256").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("signatures_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("signatures_form_document_id_unique").on(table.formDocumentId),
    foreignKey({
      name: "signatures_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "signatures_document_org_fk",
      columns: [table.organizationId, table.formDocumentId],
      foreignColumns: [formDocuments.organizationId, formDocuments.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "signatures_session_org_fk",
      columns: [table.organizationId, table.formSessionId],
      foreignColumns: [formSessions.organizationId, formSessions.id],
    }).onDelete("restrict"),
  ],
);

export const acceptances = pgTable(
  "acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    formDocumentId: uuid("form_document_id").notNull(),
    formSessionId: uuid("form_session_id").notNull(),
    declarationText: text("declaration_text").notNull(),
    acceptedAt: utcTimestamp("accepted_at").notNull(),
    ipHash: text("ip_hash").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("acceptances_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("acceptances_form_document_id_unique").on(table.formDocumentId),
    foreignKey({
      name: "acceptances_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "acceptances_document_org_fk",
      columns: [table.organizationId, table.formDocumentId],
      foreignColumns: [formDocuments.organizationId, formDocuments.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "acceptances_session_org_fk",
      columns: [table.organizationId, table.formSessionId],
      foreignColumns: [formSessions.organizationId, formSessions.id],
    }).onDelete("restrict"),
  ],
);
