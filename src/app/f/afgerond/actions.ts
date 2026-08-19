"use server";

import { clearFormSignedCookie } from "@/server/forms/cookie";

export async function clearSignedCookieAction(): Promise<void> {
  await clearFormSignedCookie();
}
