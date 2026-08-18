import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtColumn, updatedAtColumn, utcTimestamp } from "./columns";
import { memberRoleEnum } from "./enums";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkOrganizationId: text("clerk_organization_id").notNull(),
    name: text("name").notNull(),
    createdAt: createdAtColumn(),
    archivedAt: utcTimestamp("archived_at"),
  },
  (table) => [
    unique("organizations_clerk_organization_id_unique").on(
      table.clerkOrganizationId,
    ),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [unique("users_clerk_user_id_unique").on(table.clerkUserId)],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: memberRoleEnum("role").notNull(),
    createdAt: createdAtColumn(),
    revokedAt: utcTimestamp("revoked_at"),
  },
  (table) => [
    unique("organization_members_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("organization_members_organization_id_user_id_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_members_user_id_idx").on(table.userId),
    foreignKey({
      name: "organization_members_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "organization_members_user_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
  ],
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    externalReference: text("external_reference"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    archivedAt: utcTimestamp("archived_at"),
  },
  (table) => [
    unique("clients_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex("clients_organization_id_email_active_idx")
      .on(table.organizationId, table.email)
      .where(sql`${table.archivedAt} is null`),
    index("clients_organization_id_archived_at_idx").on(
      table.organizationId,
      table.archivedAt,
    ),
    foreignKey({
      name: "clients_organization_id_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
  ],
);
