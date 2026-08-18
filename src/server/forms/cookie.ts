import "server-only";

import { cookies } from "next/headers";
import { FORM_CREATED_TOKEN_COOKIE, FORM_SESSION_COOKIE } from "@/lib/constants";
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
