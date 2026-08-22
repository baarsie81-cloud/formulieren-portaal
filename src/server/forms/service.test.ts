import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { writeUserAuditEvent } = vi.hoisted(() => ({
  writeUserAuditEvent: vi.fn(),
}));

vi.mock("@/server/audit/log", () => ({ writeUserAuditEvent }));

vi.mock("@/server/storage/blob", () => ({
  deletePrivatePdf: vi.fn(),
  putPrivatePdf: vi.fn(),
  getPrivatePdfBytes: vi.fn(),
  assertPdfSha256: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  getDb: vi.fn(),
}));

import type { TenantContext } from "@/server/auth/tenant";
import { getDb } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { PERMANENT_DELETE_CONFIRMATION } from "@/server/forms/schema";
import {
  archiveFormRequest,
  deleteFormRequest,
  FORM_REQUEST_DELETE_CONFIRMATION_MESSAGE,
  FORM_REQUEST_NOT_ARCHIVED_MESSAGE,
  restoreFormRequest,
} from "@/server/forms/service";
import { deletePrivatePdf } from "@/server/storage/blob";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "33333333-3333-4333-8333-333333333333";
const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const documentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userId = "22222222-2222-4222-8222-222222222222";
const finalPdfBlobKey =
  "org/11111111-1111-4111-8111-111111111111/final/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf";
const signatureBlobKey =
  "org/11111111-1111-4111-8111-111111111111/signatures/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png";

function makeTenant(role: "admin" | "member"): TenantContext {
  return {
    clerkUserId: "user_clerk",
    clerkOrganizationId: "org_clerk",
    role,
    organizationId,
    organizationName: "Praktijk",
    userId,
    userDisplayName: "Jan",
  };
}

const activeRequest = {
  id: requestId,
  organizationId,
  clientId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  createdByUserId: userId,
  recipientName: "Ada Berg",
  recipientEmail: "ada@praktijk.nl",
  status: "sent" as const,
  sentAt: new Date("2026-01-01T00:00:00.000Z"),
  openedAt: null,
  completedAt: null,
  expiresAt: new Date("2027-02-01T00:00:00.000Z"),
  cancelledAt: null,
  cancelReason: null,
  documentCategory: null,
  invitationSubjectSnapshot: null,
  invitationBodySnapshot: null,
  confirmationKindSnapshot: null,
  confirmationSubjectSnapshot: null,
  confirmationBodySnapshot: null,
  invitationSentAt: null,
  clientConfirmationSentAt: null,
  archivedAt: null as Date | null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const archivedRequest = {
  ...activeRequest,
  archivedAt: new Date("2026-01-15T00:00:00.000Z"),
};

const draftDocument = {
  id: documentId,
  organizationId,
  formRequestId: requestId,
  documentTemplateId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  sortOrder: 0,
  status: "draft" as string,
  fieldsSchemaSnapshot: [],
  fieldValues: {},
  templateBlobKey: "org/template.pdf",
  finalPdfBlobKey: null as string | null,
  finalPdfSha256: null as string | null,
  finalizedAt: null as Date | null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const finalizedDocument = {
  ...draftDocument,
  status: "finalized" as const,
  finalPdfBlobKey,
  finalPdfSha256: "abc123",
  finalizedAt: new Date("2026-01-10T00:00:00.000Z"),
};

function mockSelectSequence(results: unknown[][]) {
  let call = 0;

  return vi.fn(() => {
    const rows = results[call++] ?? [];
    const terminal = {
      limit: vi.fn().mockResolvedValue(rows),
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason?: unknown) => unknown,
      ) => Promise.resolve(rows).then(resolve, reject),
    };

    const proxy: Record<string, unknown> = { ...terminal };
    for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy"]) {
      proxy[method] = vi.fn(() => proxy);
    }
    return proxy;
  });
}

function mockGetFormRequestCalls(
  request: typeof activeRequest,
  document: typeof draftDocument,
) {
  const joinRows = [
    {
      request,
      document,
      templateName: "Intake",
      organizationName: "Praktijk",
    },
  ];

  // 1) getFormRequest db: join + active token
  // 2) hasSubmittedFill db
  vi.mocked(getDb)
    .mockReturnValueOnce({
      select: mockSelectSequence([joinRows, []]),
    } as never)
    .mockReturnValueOnce({
      select: mockSelectSequence([[]]),
    } as never);
}

function mockArchiveOrRestoreUpdate(result: typeof activeRequest | typeof archivedRequest) {
  const where = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([result]),
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason?: unknown) => unknown,
    ) => Promise.resolve(undefined).then(resolve, reject),
  });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return update;
}

describe("form request lifecycle", () => {
  beforeEach(() => {
    writeUserAuditEvent.mockReset();
    vi.mocked(getDb).mockReset();
    vi.mocked(deletePrivatePdf).mockReset();
    vi.mocked(deletePrivatePdf).mockResolvedValue(undefined as never);
  });

  describe.each([
    ["admin", makeTenant("admin")],
    ["member", makeTenant("member")],
  ] as const)("as %s", (_label, tenant) => {
    it("archives an active request", async () => {
      mockGetFormRequestCalls(activeRequest, draftDocument);
      const update = mockArchiveOrRestoreUpdate(archivedRequest);

      vi.mocked(getDb).mockReturnValueOnce({
        transaction: vi.fn(async (cb: (tx: { update: typeof update }) => unknown) =>
          cb({ update }),
        ),
      } as never);

      const result = await archiveFormRequest(tenant, requestId);

      expect(result.archivedAt).toBeTruthy();
      expect(writeUserAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenant,
          action: "form_request.archived",
          entityId: requestId,
        }),
      );
    });

    it("restores an archived request", async () => {
      mockGetFormRequestCalls(archivedRequest, draftDocument);
      const update = mockArchiveOrRestoreUpdate(activeRequest);

      vi.mocked(getDb).mockReturnValueOnce({
        transaction: vi.fn(async (cb: (tx: { update: typeof update }) => unknown) =>
          cb({ update }),
        ),
      } as never);

      const result = await restoreFormRequest(tenant, requestId);

      expect(result.archivedAt).toBeNull();
      expect(writeUserAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenant,
          action: "form_request.restored",
          entityId: requestId,
        }),
      );
    });

    it("permanently deletes an archived non-finalized request", async () => {
      mockGetFormRequestCalls(archivedRequest, draftDocument);

      const select = mockSelectSequence([
        [{ id: documentId, status: "draft", finalPdfBlobKey: null }],
        [], // signatures
        [], // sessions
      ]);

      const tx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        select: mockSelectSequence([[]]),
        delete: vi
          .fn()
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: requestId }]),
            }),
          }),
      };

      vi.mocked(getDb).mockReturnValueOnce({
        select,
        transaction: vi.fn(async (cb: (txArg: typeof tx) => unknown) => cb(tx)),
      } as never);

      const result = await deleteFormRequest(
        tenant,
        requestId,
        PERMANENT_DELETE_CONFIRMATION,
      );

      expect(result).toEqual({ id: requestId });
      expect(writeUserAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenant,
          action: "form_request.deleted",
          entityId: requestId,
          metadata: expect.objectContaining({
            confirmation: "typed",
            hadFinalizedDocument: false,
            hadSignatures: false,
            hadFinalPdf: false,
          }),
        }),
      );
      expect(deletePrivatePdf).not.toHaveBeenCalled();
    });

    it("permanently deletes an archived finalized/signed request and cleans blobs", async () => {
      mockGetFormRequestCalls(archivedRequest, finalizedDocument);

      const select = mockSelectSequence([
        [{ id: documentId, status: "finalized", finalPdfBlobKey }],
        [{ id: "sig-1", signatureBlobKey, formDocumentId: documentId }],
        [],
      ]);

      const tx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        select: mockSelectSequence([[]]),
        delete: vi
          .fn()
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
          .mockReturnValueOnce({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: requestId }]),
            }),
          }),
      };

      vi.mocked(getDb).mockReturnValueOnce({
        select,
        transaction: vi.fn(async (cb: (txArg: typeof tx) => unknown) => cb(tx)),
      } as never);

      const result = await deleteFormRequest(
        tenant,
        requestId,
        PERMANENT_DELETE_CONFIRMATION,
      );

      expect(result).toEqual({ id: requestId });
      expect(writeUserAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "form_request.deleted",
          metadata: expect.objectContaining({
            hadFinalizedDocument: true,
            hadSignatures: true,
            hadFinalPdf: true,
          }),
        }),
      );
      expect(deletePrivatePdf).toHaveBeenCalledWith(finalPdfBlobKey);
      expect(deletePrivatePdf).toHaveBeenCalledWith(signatureBlobKey);
    });
  });

  it("blocks permanent delete of an active request", async () => {
    const tenant = makeTenant("admin");
    mockGetFormRequestCalls(activeRequest, draftDocument);

    await expect(
      deleteFormRequest(tenant, requestId, PERMANENT_DELETE_CONFIRMATION),
    ).rejects.toMatchObject({
      name: "ConflictError",
      message: FORM_REQUEST_NOT_ARCHIVED_MESSAGE,
    });

    expect(deletePrivatePdf).not.toHaveBeenCalled();
  });

  it("blocks permanent delete with wrong confirmation", async () => {
    const tenant = makeTenant("member");

    await expect(deleteFormRequest(tenant, requestId, "verwijderen")).rejects.toMatchObject({
      name: "ValidationError",
      message: FORM_REQUEST_DELETE_CONFIRMATION_MESSAGE,
    });

    expect(getDb).not.toHaveBeenCalled();
  });

  it("blocks access for a request outside the organization", async () => {
    const tenant = makeTenant("admin");

    vi.mocked(getDb).mockReturnValue({
      select: mockSelectSequence([[]]),
    } as never);

    await expect(archiveFormRequest(tenant, requestId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(restoreFormRequest(tenant, requestId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      deleteFormRequest(tenant, requestId, PERMANENT_DELETE_CONFIRMATION),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(tenant.organizationId).not.toBe(otherOrganizationId);
  });
});
