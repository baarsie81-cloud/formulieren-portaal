import "server-only";

import { cookies } from "next/headers";
import { FORM_CREATED_TOKEN_COOKIE, FORM_SESSION_COOKIE, FORM_SIGNED_COOKIE } from "@/lib/constants";
import { rawTokenSchema } from "@/server/forms/schema";
import {
  parseFormSessionCookie,
  serializeFormSessionCookie,
} from "@/server/forms/session-cookie";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const CREATED_TOKEN_MAX_AGE_SECONDS = 120;

export async function readFormSessionCookie() {
  const store = await cookies();
  return parseFormSessionCookie(store.get(FORM_SESSION_COOKIE)?.value);
}

export async function writeFormSessionCookie(sessionId: string, nonce: string, maxAgeSeconds: number) {
  const store = await cookies();

  store.set(FORM_SESSION_COOKIE, serializeFormSessionCookie(sessionId, nonce), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/f",
    maxAge: Math.max(60, Math.min(maxAgeSeconds, SESSION_MAX_AGE_SECONDS)),
  });
}

export async function writeCreatedTokenCookie(requestId: string, rawToken: string) {
  const store = await cookies();

  store.set(FORM_CREATED_TOKEN_COOKIE, `${requestId}.${rawToken}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/dashboard/requests",
    maxAge: CREATED_TOKEN_MAX_AGE_SECONDS,
  });
}

export async function readCreatedTokenCookie(requestId: string): Promise<string | null> {
  const store = await cookies();
  const value = store.get(FORM_CREATED_TOKEN_COOKIE)?.value ?? null;

  if (!value) {
    return null;
  }

  const separator = value.indexOf(".");

  if (separator <= 0) {
    return null;
  }

  const cookieRequestId = value.slice(0, separator);
  const rawToken = value.slice(separator + 1);

  if (cookieRequestId !== requestId || !rawTokenSchema.safeParse(rawToken).success) {
    return null;
  }

  return rawToken;
}

export async function writeFormSignedCookie(recipientName: string) {
  const store = await cookies();
  const encoded = Buffer.from(recipientName, "utf8").toString("base64url");

  store.set(FORM_SIGNED_COOKIE, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/f",
    maxAge: 300,
  });
}

export async function readFormSignedCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(FORM_SIGNED_COOKIE)?.value;

  if (!value) {
    return null;
  }

  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export async function clearFormSignedCookie(): Promise<void> {
  const store = await cookies();
  store.delete(FORM_SIGNED_COOKIE);
}

/** @deprecated Call readFormSignedCookie() in Server Components, clearFormSignedCookie() in Server Actions. */
export async function readAndClearFormSignedCookie(): Promise<string | null> {
  const name = await readFormSignedCookie();
  await clearFormSignedCookie();
  return name;
}

export async function clearFormSessionCookie() {
  const store = await cookies();
  store.delete(FORM_SESSION_COOKIE);
}
