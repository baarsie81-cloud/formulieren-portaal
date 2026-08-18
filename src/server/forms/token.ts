import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { RAW_TOKEN_PATTERN } from "@/lib/constants";

const TOKEN_BYTES = 32;

export function generateRawSecret(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function isRawToken(value: string): boolean {
  return RAW_TOKEN_PATTERN.test(value);
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashesMatch(expectedHex: string, actualHex: string): boolean {
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = Buffer.from(actualHex, "hex");

    if (expected.length === 0 || expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
