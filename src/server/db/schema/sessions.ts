import {
  foreignKey,
  index,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAtColumn, utcTimestamp } from "./columns";
import { organizations } from "./core";
import { formRequests } from "./forms";

export const secureTokens = pgTable(
  "secure_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    formRequestId: uuid("form_request_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    revokedAt: utcTimestamp("revoked_at"),
    lastUsedAt: utcTimestamp("last_used_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("secure_tokens_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("secure_tokens_token_hash_unique").on(table.tokenHash),
    uniqueIndex("secure_tokens_form_request_id_active_idx")
      .on(table.formRequestId)
      .where(sql`${table.revokedAt} is null`),
    index("secure_tokens_organization_id_request_id_idx").on(
      table.organizationId,
      table.formRequestId,
    ),
    foreignKey({
      name: "secure_tokens_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "secure_tokens_request_org_fk",
      columns: [table.organizationId, table.formRequestId],
      foreignColumns: [formRequests.organizationId, formRequests.id],
    }).onDelete("restrict"),
  ],
);

export const formSessions = pgTable(
  "form_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    formRequestId: uuid("form_request_id").notNull(),
    secureTokenId: uuid("secure_token_id").notNull(),
    nonceHash: text("nonce_hash").notNull(),
    ipHash: text("ip_hash").notNull(),
    userAgent: text("user_agent"),
    startedAt: utcTimestamp("started_at").notNull().defaultNow(),
    lastSeenAt: utcTimestamp("last_seen_at").notNull().defaultNow(),
    completedAt: utcTimestamp("completed_at"),
    revokedAt: utcTimestamp("revoked_at"),
  },
  (table) => [
    unique("form_sessions_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("form_sessions_request_id_started_at_idx").on(
      table.formRequestId,
      table.startedAt,
    ),
    index("form_sessions_secure_token_id_idx").on(table.secureTokenId),
    foreignKey({
      name: "form_sessions_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "form_sessions_request_org_fk",
      columns: [table.organizationId, table.formRequestId],
      foreignColumns: [formRequests.organizationId, formRequests.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "form_sessions_token_org_fk",
      columns: [table.organizationId, table.secureTokenId],
      foreignColumns: [secureTokens.organizationId, secureTokens.id],
    }).onDelete("restrict"),
  ],
);
