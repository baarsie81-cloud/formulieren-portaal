import "server-only";

import { redirect } from "next/navigation";
import { AuthError } from "@/server/auth/session";
import { requireTenant, type TenantContext } from "@/server/auth/tenant";

export async function requireDashboardContext(): Promise<TenantContext> {
  try {
    return await requireTenant();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.status === 401 ? "/sign-in" : "/select-organization");
    }

    throw error;
  }
}
