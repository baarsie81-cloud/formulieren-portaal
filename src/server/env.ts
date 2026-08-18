import "server-only";

import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const serverEnvSchema = z.object({
  TZ: z.string().default("Europe/Amsterdam"),
  DATABASE_URL: optionalSecret,
  DATABASE_URL_UNPOOLED: optionalSecret,
  CLERK_SECRET_KEY: optionalSecret,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

function readServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    TZ: process.env.TZ,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  });

  if (!parsed.success) {
    throw new Error("Invalid server environment variables");
  }

  return parsed.data;
}

export function getServerEnv(): ServerEnv {
  cachedEnv ??= readServerEnv();
  return cachedEnv;
}

export function getDatabaseUrl(): string {
  const databaseUrl = getServerEnv().DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  return databaseUrl;
}
