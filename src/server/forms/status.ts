import type { FormRequestStatus } from "@/lib/constants";

const TERMINAL_STATUSES: ReadonlySet<FormRequestStatus> = new Set([
  "completed",
  "expired",
  "cancelled",
]);

export function effectiveRequestStatus(
  status: FormRequestStatus,
  expiresAt: Date,
  now = new Date(),
): FormRequestStatus {
  if (TERMINAL_STATUSES.has(status)) {
    return status;
  }

  if (expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  return status;
}

export function isWritableRequestStatus(status: FormRequestStatus): boolean {
  return status === "sent" || status === "opened" || status === "in_progress";
}

export function isOpenableRequestStatus(status: FormRequestStatus): boolean {
  return isWritableRequestStatus(status);
}

export function isSignableRequestStatus(status: FormRequestStatus): boolean {
  return status === "opened" || status === "in_progress";
}
