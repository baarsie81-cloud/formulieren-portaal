import { describe, expect, it } from "vitest";
import { APP_NAME, APP_TAGLINE, TIMEZONE } from "@/lib/constants";

describe("app constants", () => {
  it("exposes the Dutch product name and tagline", () => {
    expect(APP_NAME).toBe("Formulieren Portaal");
    expect(APP_TAGLINE).toBe("Beveiligd beheer van cliëntformulieren");
  });

  it("uses the Europe/Amsterdam timezone", () => {
    expect(TIMEZONE).toBe("Europe/Amsterdam");
  });
});
