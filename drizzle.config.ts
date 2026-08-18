import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: databaseUrl ? { url: databaseUrl } : undefined,
  strict: true,
  verbose: true,
});
