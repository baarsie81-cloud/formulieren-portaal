import "server-only";

import { Resend } from "resend";
import { getServerEnv } from "@/server/env";
import { EmailError } from "@/server/errors";

let resendClient: Resend | undefined;

function requireResendApiKey(): string {
  const apiKey = getServerEnv().RESEND_API_KEY;

  if (!apiKey) {
    throw new EmailError("RESEND_API_KEY is not set");
  }

  return apiKey;
}

function getResendClient(): Resend {
  resendClient ??= new Resend(requireResendApiKey());
  return resendClient;
}

export type DeliverEmailInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type DeliverEmailResult = {
  messageId: string;
};

export async function deliverEmail(
  input: DeliverEmailInput,
): Promise<DeliverEmailResult> {
  const { data, error } = await getResendClient().emails.send({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });

  if (error) {
    throw new EmailError(error.message);
  }

  if (!data?.id) {
    throw new EmailError("Email provider did not return a message id");
  }

  return { messageId: data.id };
}
