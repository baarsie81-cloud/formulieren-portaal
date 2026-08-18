import { describe, expect, it } from "vitest";
import { parseCreateFormRequest, parseRawToken } from "@/server/forms/schema";
import { generateRawSecret } from "@/server/forms/token";

describe("parseCreateFormRequest", () => {
  it("requires two UUIDs", () => {
    expect(
      parseCreateFormRequest({
        clientId: "11111111-1111-4111-8111-111111111111",
        templateId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);

    expect(
      parseCreateFormRequest({
        clientId: "",
        templateId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toEqual({
      success: false,
      error: "Kies een cliënt en een PDF-sjabloon.",
    });
  });
});

describe("parseRawToken", () => {
  it("accepts generated tokens and rejects lookup-by-id values", () => {
    expect(parseRawToken(generateRawSecret())).toEqual(expect.any(String));
    expect(parseRawToken("11111111-1111-4111-8111-111111111111")).toBeNull();
    expect(parseRawToken("../etc/passwd")).toBeNull();
  });
});
