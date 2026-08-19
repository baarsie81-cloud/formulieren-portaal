import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";

const { readFormSignedCookie, clearFormSignedCookie, readAndClearFormSignedCookie } =
  await import("@/server/forms/cookie");

function makeStore(value: string | undefined) {
  return {
    get: vi.fn(() => (value !== undefined ? { value } : undefined)),
    delete: vi.fn(),
    set: vi.fn(),
  };
}

describe("readFormSignedCookie", () => {
  it("decodes a base64url name and does NOT delete the cookie", async () => {
    const encoded = Buffer.from("Ada Lovelace", "utf8").toString("base64url");
    const store = makeStore(encoded);
    vi.mocked(cookies).mockResolvedValue(store as never);

    const result = await readFormSignedCookie();

    expect(result).toBe("Ada Lovelace");
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("returns null when the cookie is absent", async () => {
    const store = makeStore(undefined);
    vi.mocked(cookies).mockResolvedValue(store as never);

    expect(await readFormSignedCookie()).toBeNull();
  });

  it("returns null when the cookie store has no entry", async () => {
    const store = makeStore(undefined);
    vi.mocked(cookies).mockResolvedValue(store as never);

    expect(await readFormSignedCookie()).toBeNull();
  });

  it("decodes special characters correctly", async () => {
    const name = "Ève Müller-Dänholm";
    const encoded = Buffer.from(name, "utf8").toString("base64url");
    const store = makeStore(encoded);
    vi.mocked(cookies).mockResolvedValue(store as never);

    expect(await readFormSignedCookie()).toBe(name);
    expect(store.delete).not.toHaveBeenCalled();
  });
});

describe("clearFormSignedCookie", () => {
  it("deletes the signed cookie from the store", async () => {
    const store = makeStore("anything");
    vi.mocked(cookies).mockResolvedValue(store as never);

    await clearFormSignedCookie();

    expect(store.delete).toHaveBeenCalledWith("fp_form_signed");
  });
});

describe("readAndClearFormSignedCookie (deprecated)", () => {
  it("reads and then deletes in sequence", async () => {
    const encoded = Buffer.from("Jan", "utf8").toString("base64url");
    const store = makeStore(encoded);
    vi.mocked(cookies).mockResolvedValue(store as never);

    const result = await readAndClearFormSignedCookie();

    expect(result).toBe("Jan");
    expect(store.delete).toHaveBeenCalledWith("fp_form_signed");
  });
});
