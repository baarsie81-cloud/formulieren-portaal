import { z } from "zod";

export const sendEmailInputSchema = z.object({
  organizationId: z.uuid(),
  to: z
    .string()
    .trim()
    .min(1)
    .max(320)
    .pipe(z.email())
    .transform((value) => value.toLowerCase()),
  subject: z.string().trim().min(1).max(200),
  html: z.string().trim().min(1).max(100_000),
  text: z.string().trim().min(1).max(100_000).optional(),
  replyTo: z
    .string()
    .trim()
    .min(1)
    .max(320)
    .pipe(z.email())
    .transform((value) => value.toLowerCase())
    .optional(),
  formRequestId: z.uuid().optional(),
  reminderDeliveryId: z.uuid().optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailInputSchema>;

export type SendEmailResult = {
  messageId: string;
};
