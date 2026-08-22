import { z } from "zod";

export const formRequestIdSchema = z.uuid();
export const rawTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/);

const mailSubjectSchema = z.string().trim().min(1).max(200);
const mailBodySchema = z.string().trim().min(1).max(100_000);

export type CreateFormRequestInput = {
  clientId: string;
  templateId: string;
  invitationSubject: string;
  invitationBody: string;
  confirmationSubject: string;
  confirmationBody: string;
};

export function readCreateFormRequestFields(formData: FormData): {
  clientId: string;
  templateId: string;
  invitationSubject: string;
  invitationBody: string;
  confirmationSubject: string;
  confirmationBody: string;
} {
  return {
    clientId: readFormString(formData, "clientId"),
    templateId: readFormString(formData, "templateId"),
    invitationSubject: readFormString(formData, "invitationSubject"),
    invitationBody: readFormString(formData, "invitationBody"),
    confirmationSubject: readFormString(formData, "confirmationSubject"),
    confirmationBody: readFormString(formData, "confirmationBody"),
  };
}

export function parseCreateFormRequest(data: {
  clientId: string;
  templateId: string;
  invitationSubject: string;
  invitationBody: string;
  confirmationSubject: string;
  confirmationBody: string;
}):
  | { success: true; data: CreateFormRequestInput }
  | { success: false; error: string } {
  const parsed = z
    .object({
      clientId: z.uuid(),
      templateId: z.uuid(),
      invitationSubject: mailSubjectSchema,
      invitationBody: mailBodySchema,
      confirmationSubject: mailSubjectSchema,
      confirmationBody: mailBodySchema,
    })
    .safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      error: "Controleer de cliënt, het sjabloon en beide e-mailteksten.",
    };
  }

  return { success: true, data: parsed.data };
}

export function parseRawToken(value: string): string | null {
  const parsed = rawTokenSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
