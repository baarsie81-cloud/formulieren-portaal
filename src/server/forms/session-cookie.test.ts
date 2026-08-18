import { describe, expect, it } from "vitest";
import { parseFormSessionCookie, serializeFormSessionCookie } from "@/server/forms/session-cookie";
import { generateRawSecret } from "@/server/forms/token";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

describe("form session cookie", () => {
  it("round-trips a session id and nonce", () => {
    const nonce = generateRawSecret();
    const value = serializeFormSessionCookie(SESSION_ID, nonce);

    expect(parseFormSessionCookie(value)).toEqual({
      sessionId: SESSION_ID,
      nonce,
    });
  });

  it("rejects forged or truncated values", () => {
    expect(parseFormSessionCookie(undefined)).toBeNull();
    expect(parseFormSessionCookie("not-a-cookie")).toBeNull();
    expect(parseFormSessionCookie(`${SESSION_ID}.short`)).toBeNull();
    expect(parseFormSessionCookie(`not-uuid.${generateRawSecret()}`)).toBeNull();
  });
});
