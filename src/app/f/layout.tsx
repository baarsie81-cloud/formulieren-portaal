import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Formulier · ${APP_NAME}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PublicFormLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-4xl px-4 py-10">{children}</div>
    </main>
  );
}
