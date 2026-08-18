import { describe, expect, it } from "vitest";
import {
  APP_NAME,
  APP_TAGLINE,
  DOCUMENT_FIELD_TYPES,
  MAX_TEMPLATE_PDF_BYTES,
  TIMEZONE,
} from "@/lib/constants";

describe("app constants", () => {
  it("exposes the Dutch product name and tagline", () => {
    expect(APP_NAME).toBe("Formulieren Portaal");
    expect(APP_TAGLINE).toBe("Beveiligd beheer van cliëntformulieren");
  });

  it("uses the Europe/Amsterdam timezone", () => {
    expect(TIMEZONE).toBe("Europe/Amsterdam");
  });

  it("caps template PDF uploads under the function body limit", () => {
    expect(MAX_TEMPLATE_PDF_BYTES).toBe(4 * 1024 * 1024);
    expect(DOCUMENT_FIELD_TYPES).toContain("signature_area");
  });
});
