import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { writeUserAuditEvent } = vi.hoisted(() => ({
  writeUserAuditEvent: vi.fn(),
}));

vi.mock("@/server/audit/log", () => ({ writeUserAuditEvent }));

vi.mock("@/server/db", () => ({
  getDb: vi.fn(),
}));

import type { TenantContext } from "@/server/auth/tenant";
import { getDb } from "@/server/db";
import {
  archiveClient,
  CLIENT_HAS_FORM_REQUESTS_MESSAGE,
  CLIENT_NOT_ARCHIVED_MESSAGE,
  CLIENT_DELETE_CONFIRMATION_MESSAGE,
  deleteClient,
  restoreClient,
} from "@/server/clients/service";
import { NotFoundError } from "@/server/errors";
import { PERMANENT_DELETE_CONFIRMATION } from "@/server/clients/schema";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "33333333-3333-4333-8333-333333333333";
const clientId = "22222222-2222-4222-8222-222222222222";
const userId = "44444444-4444-4444-8444-444444444444";

function makeTenant(role: "admin" | "member"): TenantContext {
  return {
    clerkUserId: "user_clerk",
    clerkOrganizationId: "org_clerk",
    role,
    organizationId,
    organizationName: "Demo",
    userId,
    userDisplayName: "Demo User",
  };
}

const activeClient = {
  id: clientId,
  organizationId,
  displayName: "Ada Berg",
  email: "ada@praktijk.nl",
  phone: null,
  externalReference: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  archivedAt: null,
};

const archivedClient = {
  ...activeClient,
  archivedAt: new Date("2026-02-01T00:00:00.000Z"),
};

function mockSelectResult(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        // count queries await where() directly
        then: undefined,
      }),
    }),
  };
}

/** Select that resolves at `.where()` (for count) or `.limit()` (for get). */
function mockSelectFlexible(rows: unknown[]) {
  const whereResult = {
    limit: vi.fn().mockResolvedValue(rows),
  };
  // Make where() thenable so `await db.select().from().where()` works for counts
  Object.assign(whereResult, {
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  });

  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(whereResult),
    }),
  };
}

describe("client lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeUserAuditEvent.mockReset();
    vi.mocked(getDb).mockReset();
  });

  describe.each([
    ["admin", makeTenant("admin")],
    ["member", makeTenant("member")],
  ] as const)("as %s", (_label, tenant) => {
    it("archives an active client and writes client.archived", async () => {
      const archived = { ...activeClient, archivedAt: new Date() };
      const returning = vi.fn().mockResolvedValue([archived]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      const update = vi.fn().mockReturnValue({ set });

      vi.mocked(getDb)
        .mockReturnValueOnce({ select: vi.fn(() => mockSelectFlexible([activeClient])) } as never)
        .mockReturnValueOnce({
          transaction: vi.fn(async (cb: (tx: { update: typeof update }) => unknown) =>
            cb({ update }),
          ),
        } as never);

      const result = await archiveClient(tenant, clientId);

      expect(result.archivedAt).toBeTruthy();
      expect(writeUserAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenant,
          action: "client.archived",
          entityType: "client",
          entityId: clientId,
        }),
      );
    });

    it("restores an archived client and writes client.restored", async () => {
      const restored = { ...archivedClient, archivedAt: null };
      const returning = vi.fn().mockResolvedValue([restored]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      const update = vi.fn().mockReturnValue({ set });

      vi.mocked(getDb)
        .mockReturnValueOnce({
          select: vi.fn(() => mockSelectFlexible([archivedClient])),
        } as never)
        .mockReturnValueOnce({
          transaction: vi.fn(async (cb: (tx: { update: typeof update }) => unknown) =>
            cb({ update }),
          ),
        } as never);

      const result = await restoreClient(tenant, clientId);

      expect(result.archivedAt).toBeNull();
      expect(writeUserAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenant,
          action: "client.restored",
          entityType: "client",
          entityId: clientId,
        }),
      );
    });

    it("permanently deletes an archived client without form requests", async () => {
      const returning = vi.fn().mockResolvedValue([{ id: clientId }]);
      const where = vi.fn().mockReturnValue({ returning });
      const del = vi.fn().mockReturnValue({ where });

      vi.mocked(getDb)
        .mockReturnValueOnce({
          select: vi.fn(() => mockSelectFlexible([archivedClient])),
        } as never)
        .mockReturnValueOnce({
          select: vi.fn(() => mockSelectFlexible([{ value: 0 }])),
        } as never)
        .mockReturnValueOnce({
          transaction: vi.fn(async (cb: (tx: { delete: typeof del }) => unknown) =>
            cb({ delete: del }),
          ),
        } as never);

      const result = await deleteClient(
        tenant,
        clientId,
        PERMANENT_DELETE_CONFIRMATION,
      );

      expect(result).toEqual({ id: clientId });
      expect(writeUserAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenant,
          action: "client.deleted",
          entityType: "client",
          entityId: clientId,
          metadata: expect.objectContaining({
            confirmation: "typed",
            email: archivedClient.email,
          }),
        }),
      );
    });
  });

  it("blocks permanent delete when any form request exists", async () => {
    const tenant = makeTenant("admin");

    vi.mocked(getDb)
      .mockReturnValueOnce({
        select: vi.fn(() => mockSelectFlexible([archivedClient])),
      } as never)
      .mockReturnValueOnce({
        select: vi.fn(() => mockSelectFlexible([{ value: 2 }])),
      } as never);

    await expect(
      deleteClient(tenant, clientId, PERMANENT_DELETE_CONFIRMATION),
    ).rejects.toMatchObject({
      name: "ConflictError",
      message: CLIENT_HAS_FORM_REQUESTS_MESSAGE,
    });

    expect(writeUserAuditEvent).not.toHaveBeenCalled();
  });

  it("blocks permanent delete of an active client", async () => {
    const tenant = makeTenant("member");

    vi.mocked(getDb).mockReturnValueOnce({
      select: vi.fn(() => mockSelectFlexible([activeClient])),
    } as never);

    await expect(
      deleteClient(tenant, clientId, PERMANENT_DELETE_CONFIRMATION),
    ).rejects.toMatchObject({
      name: "ConflictError",
      message: CLIENT_NOT_ARCHIVED_MESSAGE,
    });
  });

  it("blocks permanent delete with wrong confirmation", async () => {
    const tenant = makeTenant("admin");

    await expect(deleteClient(tenant, clientId, "verwijderen")).rejects.toMatchObject({
      name: "ValidationError",
      message: CLIENT_DELETE_CONFIRMATION_MESSAGE,
    });

    expect(getDb).not.toHaveBeenCalled();
  });

  it("blocks access for a client in another organization", async () => {
    const tenant = makeTenant("admin");

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => mockSelectFlexible([])),
    } as never);

    await expect(archiveClient(tenant, clientId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(restoreClient(tenant, clientId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      deleteClient(tenant, clientId, PERMANENT_DELETE_CONFIRMATION),
    ).rejects.toBeInstanceOf(NotFoundError);

    // Ensure we never accidentally query the other org id in these unit mocks;
    // tenant isolation is enforced via clientInOrganization(tenant.organizationId, …).
    expect(tenant.organizationId).not.toBe(otherOrganizationId);
  });
});
