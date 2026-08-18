import { describe, expect, it } from "vitest";
import {
  activeClientsInOrganization,
  clientInOrganization,
} from "@/server/clients/scope";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";

describe("client query scope", () => {
  it("always includes organization id and client id together", () => {
    const clause = sqlValues(clientInOrganization(ORGANIZATION_ID, CLIENT_ID));

    expect(clause).toContain(ORGANIZATION_ID);
    expect(clause).toContain(CLIENT_ID);
    expect(clause).not.toContain(OTHER_ORGANIZATION_ID);
  });

  it("lists active clients only within one organization", () => {
    const clause = sqlValues(activeClientsInOrganization(ORGANIZATION_ID));

    expect(clause).toContain(ORGANIZATION_ID);
    expect(clause).not.toContain(CLIENT_ID);
    expect(clause).not.toContain(OTHER_ORGANIZATION_ID);
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
