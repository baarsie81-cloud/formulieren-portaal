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
  BLOB_READ_WRITE_TOKEN: optionalSecret,
  BLOB_STORE_ID: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  EMAIL_FROM: optionalSecret,
  HMAC_SECRET: optionalSecret,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

function readServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    TZ: process.env.TZ,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    BLOB_STORE_ID: process.env.BLOB_STORE_ID,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    HMAC_SECRET: process.env.HMAC_SECRET,
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

export function isBlobConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID);
}

export function isEmailConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function getHmacSecret(): string {
  const env = getServerEnv();
  const secret = env.HMAC_SECRET ?? env.CLERK_SECRET_KEY;

  if (!secret) {
    throw new Error("HMAC_SECRET is not set");
  }

  return secret;
}
