import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtColumn, updatedAtColumn, utcTimestamp } from "./columns";
import { clients, organizations, users } from "./core";
import {
  documentFieldTypeEnum,
  formDocumentStatusEnum,
  formRequestStatusEnum,
  templateStatusEnum,
} from "./enums";

type JsonObject = Record<string, unknown>;

export const documentTemplates = pgTable(
  "document_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    blobKey: text("blob_key").notNull(),
    sha256: text("sha256").notNull(),
    status: templateStatusEnum("status").notNull().default("active"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    unique("document_templates_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("document_templates_organization_id_status_idx").on(
      table.organizationId,
      table.status,
    ),
    foreignKey({
      name: "document_templates_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
  ],
);

export const documentFields = pgTable(
  "document_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    documentTemplateId: uuid("document_template_id").notNull(),
    pdfFieldName: text("pdf_field_name").notNull(),
    valueKey: text("value_key").notNull(),
    fieldType: documentFieldTypeEnum("field_type").notNull(),
    pageNumber: integer("page_number").notNull().default(1),
    x: doublePrecision("x"),
    y: doublePrecision("y"),
    width: doublePrecision("width"),
    height: doublePrecision("height"),
    isRequired: boolean("is_required").notNull().default(false),
    validation: jsonb("validation").$type<JsonObject | null>(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    unique("document_fields_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("document_fields_template_pdf_field_name_unique").on(
      table.documentTemplateId,
      table.pdfFieldName,
    ),
    index("document_fields_organization_id_template_id_idx").on(
      table.organizationId,
      table.documentTemplateId,
    ),
    foreignKey({
      name: "document_fields_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "document_fields_template_org_fk",
      columns: [table.organizationId, table.documentTemplateId],
      foreignColumns: [
        documentTemplates.organizationId,
        documentTemplates.id,
      ],
    }).onDelete("restrict"),
  ],
);

export const formRequests = pgTable(
  "form_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    clientId: uuid("client_id").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    recipientName: text("recipient_name").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    status: formRequestStatusEnum("status").notNull().default("sent"),
    sentAt: utcTimestamp("sent_at").notNull().defaultNow(),
    openedAt: utcTimestamp("opened_at"),
    completedAt: utcTimestamp("completed_at"),
    expiresAt: utcTimestamp("expires_at").notNull(),
    cancelledAt: utcTimestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("form_requests_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("form_requests_organization_id_status_created_at_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index("form_requests_organization_id_client_id_idx").on(
      table.organizationId,
      table.clientId,
    ),
    index("form_requests_expires_at_idx").on(table.expiresAt),
    foreignKey({
      name: "form_requests_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "form_requests_client_org_fk",
      columns: [table.organizationId, table.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "form_requests_created_by_user_id_fk",
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
  ],
);

export const formDocuments = pgTable(
  "form_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    formRequestId: uuid("form_request_id").notNull(),
    documentTemplateId: uuid("document_template_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    templateBlobKey: text("template_blob_key").notNull(),
    templateSha256: text("template_sha256").notNull(),
    fieldsSchemaSnapshot: jsonb("fields_schema_snapshot")
      .$type<unknown[]>()
      .notNull(),
    fieldValues: jsonb("field_values")
      .$type<JsonObject>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: formDocumentStatusEnum("status").notNull().default("pending"),
    finalPdfBlobKey: text("final_pdf_blob_key"),
    finalPdfSha256: text("final_pdf_sha256"),
    finalizedAt: utcTimestamp("finalized_at"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    unique("form_documents_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("form_documents_request_template_unique").on(
      table.formRequestId,
      table.documentTemplateId,
    ),
    index("form_documents_organization_id_request_id_idx").on(
      table.organizationId,
      table.formRequestId,
    ),
    foreignKey({
      name: "form_documents_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "form_documents_request_org_fk",
      columns: [table.organizationId, table.formRequestId],
      foreignColumns: [formRequests.organizationId, formRequests.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "form_documents_template_org_fk",
      columns: [table.organizationId, table.documentTemplateId],
      foreignColumns: [
        documentTemplates.organizationId,
        documentTemplates.id,
      ],
    }).onDelete("restrict"),
    check(
      "form_documents_finalized_pdf_present",
      sql`(
        (${table.status} <> 'finalized' AND ${table.finalPdfBlobKey} IS NULL AND ${table.finalPdfSha256} IS NULL AND ${table.finalizedAt} IS NULL)
        OR
        (${table.status} = 'finalized' AND ${table.finalPdfBlobKey} IS NOT NULL AND ${table.finalPdfSha256} IS NOT NULL AND ${table.finalizedAt} IS NOT NULL)
      )`,
    ),
  ],
);
