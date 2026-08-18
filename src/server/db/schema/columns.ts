import { timestamp } from "drizzle-orm/pg-core";

export function utcTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, mode: "date" });
}

export function createdAtColumn() {
  return utcTimestamp("created_at").notNull().defaultNow();
}

export function updatedAtColumn() {
  return utcTimestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
}
