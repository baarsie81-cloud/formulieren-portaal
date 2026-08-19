import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, StorageError } from "@/server/errors";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const signAndFinalizePublicForm = vi.fn();
vi.mock("@/server/forms/signing", () => ({
  signAndFinalizePublicForm,
}));

const loadFormCompletionEmailContext = vi.fn();
const sendFormCompletionNotifications = vi.fn();
vi.mock("@/server/email/confirmation", () => ({
  loadFormCompletionEmailContext,
  sendFormCompletionNotifications,
}));

const getPublicFormContext = vi.fn();
vi.mock("@/server/forms/public", () => ({
  getPublicFormContext,
  savePublicFormValues: vi.fn(),
  startPublicFormSession: vi.fn(),
  submitPublicFormFill: vi.fn(),
}));

vi.mock("@/server/forms/cookie", () => ({
  clearFormSessionCookie: vi.fn(),
  writeFormSignedCookie: vi.fn(),
}));

vi.mock("@/server/forms/request-meta", () => ({
  getRequestMeta: vi.fn().mockResolvedValue({ ip: "127.0.0.1", userAgent: null }),
  getPublicOrigin: vi.fn().mockResolvedValue("https://formulierendesk.nl"),
  publicFormPath: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  getDb: vi.fn(() => ({})),
}));

const { signPublicFormAction } = await import("@/server/forms/public-actions");

describe("signPublicFormAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicFormContext.mockResolvedValue({ recipientName: "Ada Lovelace" });
    loadFormCompletionEmailContext.mockResolvedValue({
      organizationId: "11111111-1111-4111-8111-111111111111",
      organizationName: "Praktijk De Linde",
      recipientEmail: "client@example.com",
      recipientName: "Ada Lovelace",
      formRequestId: "22222222-2222-4222-8222-222222222222",
      createdByUserId: "33333333-3333-4333-8333-333333333333",
    });
    signAndFinalizePublicForm.mockResolvedValue(undefined);
    sendFormCompletionNotifications.mockResolvedValue(undefined);
  });

  function buildFormData() {
    const formData = new FormData();
    formData.set("token", "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ");
    formData.set("method", "drawn");
    formData.set("signerName", "Ada Lovelace");
    formData.set("signatureDataUrl", "data:image/png;base64,abc");
    formData.set("acceptedDeclaration", "on");
    return formData;
  }

  it("does not send completion emails when finalize fails", async () => {
    signAndFinalizePublicForm.mockRejectedValue(new ConflictError("Document is already finalized"));

    const result = await signPublicFormAction({ error: null, saved: false }, buildFormData());

    expect(result.error).toBeTruthy();
    expect(sendFormCompletionNotifications).not.toHaveBeenCalled();
  });

  it("returns a user-friendly error instead of crashing when storage fails", async () => {
    signAndFinalizePublicForm.mockRejectedValue(new StorageError("BLOB_READ_WRITE_TOKEN is not set"));

    const result = await signPublicFormAction({ error: null, saved: false }, buildFormData());

    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("BLOB_READ_WRITE_TOKEN");
    expect(sendFormCompletionNotifications).not.toHaveBeenCalled();
  });

  it("sends completion emails only after successful finalize", async () => {
    await signPublicFormAction({ error: null, saved: false }, buildFormData());

    expect(signAndFinalizePublicForm).toHaveBeenCalled();
    expect(sendFormCompletionNotifications).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        recipientEmail: "client@example.com",
        dashboardOrigin: "https://formulierendesk.nl",
      }),
    );
    expect(signAndFinalizePublicForm.mock.invocationCallOrder[0]).toBeLessThan(
      sendFormCompletionNotifications.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("continues to redirect when completion emails fail", async () => {
    sendFormCompletionNotifications.mockRejectedValue(new Error("mail failed"));
    const { redirect } = await import("next/navigation");

    await signPublicFormAction({ error: null, saved: false }, buildFormData());

    expect(redirect).toHaveBeenCalledWith("/f/afgerond");
  });
});
