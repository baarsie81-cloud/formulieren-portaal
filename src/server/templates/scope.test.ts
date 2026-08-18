import { describe, expect, it } from "vitest";
import {
  activeTemplatesInOrganization,
  fieldInOrganization,
  fieldsInTemplate,
  templateInOrganization,
} from "@/server/templates/scope";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const FIELD_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";

describe("template query scope", () => {
  it("always includes organization id and template id together", () => {
    const clause = sqlValues(templateInOrganization(ORGANIZATION_ID, TEMPLATE_ID));

    expect(clause).toContain(ORGANIZATION_ID);
    expect(clause).toContain(TEMPLATE_ID);
    expect(clause).not.toContain(OTHER_ORGANIZATION_ID);
  });

  it("lists active templates only within one organization", () => {
    const clause = sqlValues(activeTemplatesInOrganization(ORGANIZATION_ID));

    expect(clause).toContain(ORGANIZATION_ID);
    expect(clause).toContain("active");
    expect(clause).not.toContain(TEMPLATE_ID);
    expect(clause).not.toContain(OTHER_ORGANIZATION_ID);
  });

  it("scopes fields by organization and template", () => {
    const fieldsClause = sqlValues(fieldsInTemplate(ORGANIZATION_ID, TEMPLATE_ID));
    const fieldClause = sqlValues(fieldInOrganization(ORGANIZATION_ID, FIELD_ID));

    expect(fieldsClause).toContain(ORGANIZATION_ID);
    expect(fieldsClause).toContain(TEMPLATE_ID);
    expect(fieldClause).toContain(ORGANIZATION_ID);
    expect(fieldClause).toContain(FIELD_ID);
    expect(fieldsClause).not.toContain(OTHER_ORGANIZATION_ID);
  });
});

function sqlValues(condition: { getSQL: () => { queryChunks: unknown[] } } | undefined) {
  if (!condition) {
    return "";
  }

  return collectValues(condition.getSQL());
}

function collectValues(node: unknown): string {
  if (node == null) {
    return "";
  }

  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return String(node);
  }

  if (typeof node !== "object") {
    return "";
  }

  if ("value" in node && (typeof node.value === "string" || typeof node.value === "number")) {
    return String(node.value);
  }

  if ("queryChunks" in node && Array.isArray(node.queryChunks)) {
    return node.queryChunks.map(collectValues).join(" ");
  }

  return "";
}
