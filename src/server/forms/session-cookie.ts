import { formRequestIdSchema, rawTokenSchema } from "@/server/forms/schema";

export function serializeFormSessionCookie(sessionId: string, nonce: string): string {
  return `${sessionId}.${nonce}`;
}

export function parseFormSessionCookie(
  value: string | undefined,
): { sessionId: string; nonce: string } | null {
  if (!value) {
    return null;
  }

  const separator = value.indexOf(".");

  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }

  const sessionId = value.slice(0, separator);
  const nonce = value.slice(separator + 1);

  if (!formRequestIdSchema.safeParse(sessionId).success) {
    return null;
  }

  if (!rawTokenSchema.safeParse(nonce).success) {
    return null;
  }

  return { sessionId, nonce };
}
