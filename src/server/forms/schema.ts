import { z } from "zod";

export const formRequestIdSchema = z.uuid();
export const rawTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/);

export type CreateFormRequestInput = {
  clientId: string;
  templateId: string;
};

export function readCreateFormRequestFields(formData: FormData): {
  clientId: string;
  templateId: string;
} {
  return {
    clientId: readFormString(formData, "clientId"),
    templateId: readFormString(formData, "templateId"),
  };
}

export function parseCreateFormRequest(data: {
  clientId: string;
  templateId: string;
}): { success: true; data: CreateFormRequestInput } | { success: false; error: string } {
  const parsed = z
    .object({
      clientId: z.uuid(),
      templateId: z.uuid(),
    })
    .safeParse(data);

  if (!parsed.success) {
    return { success: false, error: "Kies een cliënt en een PDF-sjabloon." };
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
