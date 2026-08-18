import { DashboardHeader } from "@/components/dashboard-header";
import { isClerkConfigured } from "@/lib/clerk";
import { requireDashboardContext } from "@/server/auth/guard";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isClerkConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-neutral-600">
          Clerk is niet geconfigureerd. Zet de sleutels in <code>.env.local</code>.
        </p>
      </main>
    );
  }

  try {
    await requireDashboardContext();
  } catch (error) {
    if (error instanceof Error && error.message === "DATABASE_URL is not set") {
      return (
        <main className="flex min-h-screen items-center justify-center px-6">
          <p className="text-neutral-600">
            De database is niet geconfigureerd. Zet <code>DATABASE_URL</code> in{" "}
            <code>.env.local</code>.
          </p>
        </main>
      );
    }

    throw error;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <DashboardHeader />
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
