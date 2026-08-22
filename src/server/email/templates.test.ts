import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getDefaultEmailTemplate,
  renderEmailTemplate,
  substituteEmailTemplate,
} from "@/server/email/templates";

describe("email templates", () => {
  it("substitutes known placeholders and leaves unknown tokens intact", () => {
    const rendered = substituteEmailTemplate(
      "Hallo {{recipientName}}, van {{organizationName}} {{unknown}}",
      {
        recipientName: "Ada",
        organizationName: "Praktijk",
      },
    );

    expect(rendered).toBe("Hallo Ada, van Praktijk {{unknown}}");
  });

  it("renders default intake invitation templates", () => {
    const rendered = renderEmailTemplate(getDefaultEmailTemplate("intake_invitation"), {
      recipientName: "Ada Lovelace",
      organizationName: "Praktijk De Linde",
      formUrl: "https://formulierendesk.nl/f/token",
      expiresAt: "2 september 2026 12:00",
      ttlDays: "14",
    });

    expect(rendered.subject).toBe("Formulier van Praktijk De Linde");
    expect(rendered.text).toContain("https://formulierendesk.nl/f/token");
    expect(rendered.html).toContain("Formulier openen");
  });
});
