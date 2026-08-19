import "server-only";

export { sendEmail, isEmailConfigured } from "@/server/email/send";
export type { SendEmailInput, SendEmailResult } from "@/server/email/schema";
export type { LogEmailSentEventInput } from "@/server/email/events";
export { logEmailSentEvent } from "@/server/email/events";
export {
  buildFormRequestInvitationEmail,
  sendFormRequestInvitation,
} from "@/server/email/invitation";
export type { FormRequestInvitationInput } from "@/server/email/invitation";
export {
  buildFormCompletionClientEmail,
  buildFormCompletionStaffEmail,
  loadFormCompletionEmailContext,
  sendFormCompletionClientEmail,
  sendFormCompletionNotifications,
  sendFormCompletionStaffEmail,
} from "@/server/email/confirmation";
export type {
  FormCompletionClientEmailInput,
  FormCompletionEmailContext,
  FormCompletionStaffEmailInput,
} from "@/server/email/confirmation";
