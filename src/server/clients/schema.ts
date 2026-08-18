import { z } from "zod";

const optionalNullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

export const clientInputSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  email: z
    .string()
    .trim()
    .min(1)
    .max(320)
    .pipe(z.email())
    .transform((value) => value.toLowerCase()),
  phone: optionalNullableText(40),
  externalReference: optionalNullableText(100),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

export const clientIdSchema = z.uuid();

export type ClientFormFields = {
  displayName: string;
  email: string;
  phone: string;
  externalReference: string;
};

export function readClientFormFields(formData: FormData): ClientFormFields {
  return {
    displayName: readFormString(formData, "displayName"),
    email: readFormString(formData, "email"),
    phone: readFormString(formData, "phone"),
    externalReference: readFormString(formData, "externalReference"),
  };
}

export function parseClientInput(data: ClientFormFields): {
  success: true;
  data: ClientInput;
} | {
  success: false;
  error: string;
} {
  const parsed = clientInputSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: clientValidationMessage(parsed.error) };
  }

  return { success: true, data: parsed.data };
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function clientValidationMessage(error: z.ZodError): string {
  const field = error.issues[0]?.path[0];

  if (field === "email") {
    return "Vul een geldig e-mailadres in.";
  }

  if (field === "displayName") {
    return "Vul een naam in.";
  }

  if (field === "phone") {
    return "Telefoonnummer is te lang.";
  }

  if (field === "externalReference") {
    return "Extern kenmerk is te lang.";
  }

  return "Controleer de ingevulde gegevens.";
}
